import {
  calcularFechaLimite,
  diasAtraso,
  diasRestantes,
  DIAS_RENOVACION,
  estadoPrestamo,
  formatFecha,
  MAX_RENOVACIONES,
  nombreSede,
  nuevoCodigoRetiro,
  puedeRenovar,
  sumarDias,
} from "../dominio/reglas.js";
import type { Loan, LoanView, Penalty, SedeId } from "../dominio/tipos.js";
import { lectoresPorId, libroDesconocido, nombreDe, registrarActividad, type Contexto } from "./comun.js";
import { ErrorNegocio } from "./errores.js";
import { notificar } from "./notificaciones.js";
import { crearSancion, publicarSancion } from "./sanciones.js";

export interface FiltroPrestamos {
  /** Busca por ID de prestamo, DNI, legajo, nombre, titulo, ISBN o comprobante. */
  q?: string;
  estado?: "activos" | "vencidos" | "devueltos" | "todos";
  userId?: string;
  sede?: SedeId | "todas";
}

const noHayPrestamo = () => new ErrorNegocio("NOT_FOUND", "No encontramos ese préstamo.", 404);

async function vistas(ctx: Contexto, prestamos: Loan[]): Promise<LoanView[]> {
  const [libros, sanciones, lector] = await Promise.all([
    ctx.repo.libros(),
    ctx.repo.sanciones(),
    lectoresPorId(ctx, prestamos.map((p) => p.userId)),
  ]);
  return prestamos.map((loan) => {
    const sancion = sanciones.find((s) => s.loanId === loan.id) ?? null;
    return {
      ...loan,
      libro: libros.find((l) => l.isbn === loan.isbn) ?? libroDesconocido(loan.isbn),
      estudiante: lector(loan.userId),
      estado: estadoPrestamo(loan, sancion, ctx.hoy),
      diasRestantes: diasRestantes(loan, ctx.hoy),
      diasAtraso: diasAtraso(loan, ctx.hoy),
      sancion,
    };
  });
}

/** Los mas recientes primero. */
export async function listarPrestamos(ctx: Contexto, filtro: FiltroPrestamos = {}): Promise<LoanView[]> {
  const { q = "", estado = "todos", userId, sede = "todas" } = filtro;
  const texto = q.trim().toLowerCase();
  const soloDigitos = texto.replace(/\D/g, "");

  let prestamos = (await ctx.repo.prestamos()).filter(
    (p) => (!userId || p.userId === userId) && (sede === "todas" || p.sede === sede),
  );
  if (estado === "activos") prestamos = prestamos.filter((p) => !p.fechaDevolucion);
  else if (estado === "vencidos") prestamos = prestamos.filter((p) => !p.fechaDevolucion && diasAtraso(p, ctx.hoy) > 0);
  else if (estado === "devueltos") prestamos = prestamos.filter((p) => p.fechaDevolucion !== null);

  const resultado = (await vistas(ctx, prestamos)).sort(
    (a, b) => b.fechaPrestamo.localeCompare(a.fechaPrestamo) || b.id.localeCompare(a.id),
  );
  if (!texto) return resultado;
  return resultado.filter(
    (p) =>
      p.id.toLowerCase().includes(texto) ||
      p.isbn.includes(texto) ||
      p.copia.toLowerCase().includes(texto) ||
      p.codigoRetiro.toLowerCase().includes(texto) ||
      p.libro.titulo.toLowerCase().includes(texto) ||
      p.estudiante.nombre.toLowerCase().includes(texto) ||
      (soloDigitos.length > 2 &&
        (p.estudiante.legajo.includes(soloDigitos) || p.estudiante.dni.replace(/\D/g, "").includes(soloDigitos))),
  );
}

/** Con userId (estudiante), un prestamo ajeno responde igual que uno inexistente. */
export async function obtenerPrestamo(ctx: Contexto, id: string, userId?: string): Promise<LoanView> {
  const prestamo = await ctx.repo.prestamo(id);
  if (!prestamo || (userId && prestamo.userId !== userId)) throw noHayPrestamo();
  return (await vistas(ctx, [prestamo]))[0];
}

/** Reserva el primer ejemplar disponible en la sede, con limite a 14 dias y codigo de retiro. */
export async function solicitarPrestamo(ctx: Contexto, isbn: string, sede: SedeId, userId: string): Promise<Loan> {
  const nombre = await nombreDe(ctx, userId);
  return ctx.repo.transaccion(async (r) => {
    const libro = await r.libro(isbn);
    if (!libro) throw new ErrorNegocio("NOT_FOUND", "No encontramos ese título.", 404);
    if (!libro.activo) {
      throw new ErrorNegocio("BOOK_INACTIVE", "El título está dado de baja y no se puede solicitar.", 409);
    }
    if ((await r.sanciones()).some((s) => s.userId === userId && s.estado === "pendiente")) {
      throw new ErrorNegocio(
        "SANCTION_PENDING",
        "Tenés una sanción pendiente de pago. Regularizá la multa para volver a solicitar préstamos.",
        409,
      );
    }
    if ((await r.prestamos()).some((p) => p.userId === userId && p.isbn === isbn && !p.fechaDevolucion)) {
      throw new ErrorNegocio("LOAN_EXISTS", "Ya tenés un préstamo activo de este título.", 409);
    }
    const ejemplar = (await r.ejemplares(isbn))
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
      .find((e) => e.sede === sede && e.estado === "disponible");
    if (!ejemplar) {
      throw new ErrorNegocio("NO_COPIES", `No hay ejemplares disponibles de ${libro.titulo} en ${nombreSede(sede)}.`, 409);
    }

    const prestamo: Loan = {
      id: await r.siguienteId("prestamo"),
      isbn,
      copia: ejemplar.codigo,
      userId,
      sede,
      fechaPrestamo: ctx.hoy,
      fechaLimite: calcularFechaLimite(ctx.hoy),
      fechaDevolucion: null,
      renovaciones: 0,
      codigoRetiro: nuevoCodigoRetiro(),
      tieneReservas: false,
    };
    await r.guardarPrestamo(prestamo);
    await r.guardarEjemplares([{ ...ejemplar, estado: "prestado" }]);
    await notificar(
      r,
      userId,
      "comprobante",
      "Comprobante disponible",
      `Tu préstamo ${prestamo.id} fue registrado. Retiralo en sede ${nombreSede(sede)} hasta el ${formatFecha(prestamo.fechaLimite)}.`,
      ctx.hoy,
    );
    await registrarActividad(r, "prestamo", `Nuevo préstamo · ${libro.titulo} — ${nombre}`, ctx.hoy);
    return prestamo;
  });
}

/** Codigo de error segun el mismo orden de chequeos que puedeRenovar. */
function codigoRenovacion(loan: Loan, sancion: Penalty | null): string {
  if (loan.fechaDevolucion) return "ALREADY_RETURNED";
  if (sancion?.estado === "pendiente") return "SANCTION_PENDING";
  if (loan.renovaciones >= MAX_RENOVACIONES) return "RENEWAL_LIMIT";
  return "RENEWAL_NOT_ALLOWED";
}

/** Extiende la fecha limite 3 dias si el prestamo admite renovacion. */
export async function renovarPrestamo(ctx: Contexto, id: string, userId: string): Promise<Loan> {
  return ctx.repo.transaccion(async (r) => {
    const prestamo = await r.prestamo(id);
    if (!prestamo || prestamo.userId !== userId) throw noHayPrestamo();
    const sancion = (await r.sancionDe(id)) ?? null;
    const evaluacion = puedeRenovar(prestamo, sancion, ctx.hoy);
    if (!evaluacion.puede) throw new ErrorNegocio(codigoRenovacion(prestamo, sancion), evaluacion.motivo, 409);

    const renovado: Loan = {
      ...prestamo,
      fechaLimite: sumarDias(prestamo.fechaLimite, DIAS_RENOVACION),
      renovaciones: prestamo.renovaciones + 1,
    };
    await r.guardarPrestamo(renovado);
    await notificar(
      r,
      prestamo.userId,
      "vencimiento",
      "Préstamo renovado",
      `${(await r.libro(prestamo.isbn))?.titulo ?? "El título"} ahora vence el ${formatFecha(renovado.fechaLimite)}.`,
      ctx.hoy,
    );
    return renovado;
  });
}

/**
 * Cierra el prestamo en el mostrador: libera el ejemplar y, si el atraso
 * alcanza los 8 dias y la deteccion no lo sanciono antes, genera la sancion.
 */
export async function devolverPrestamo(ctx: Contexto, id: string): Promise<{ prestamo: Loan; sancion: Penalty | null }> {
  // Solo para el nombre de los textos (CORE fuera de la transaccion); lo que decide se relee adentro.
  const previo = await ctx.repo.prestamo(id);
  const nombre = previo ? await nombreDe(ctx, previo.userId) : "Estudiante";

  const resultado = await ctx.repo.transaccion(async (r) => {
    const prestamo = await r.prestamo(id);
    if (!prestamo) throw noHayPrestamo();
    if (prestamo.fechaDevolucion) throw new ErrorNegocio("ALREADY_RETURNED", "Este préstamo ya fue devuelto.", 409);

    const devuelto: Loan = { ...prestamo, fechaDevolucion: ctx.hoy };
    await r.guardarPrestamo(devuelto);
    const ejemplar = (await r.ejemplares(prestamo.isbn)).find((e) => e.codigo === prestamo.copia);
    if (ejemplar) await r.guardarEjemplares([{ ...ejemplar, estado: "disponible" }]);

    const sancion = await crearSancion(r, ctx.hoy, devuelto, nombre);
    const titulo = (await r.libro(prestamo.isbn))?.titulo;
    await notificar(
      r,
      prestamo.userId,
      "comprobante",
      "Devolución registrada",
      `Recibimos ${titulo ?? "el libro"} en sede ${nombreSede(prestamo.sede)}. El préstamo ${id} quedó cerrado.`,
      ctx.hoy,
    );
    await registrarActividad(r, "devolucion", `Devolución registrada · ${titulo ?? "Libro"} — ${nombre}`, ctx.hoy);
    return { prestamo: devuelto, sancion };
  });

  if (resultado.sancion) await publicarSancion(ctx, resultado.sancion);
  return resultado;
}
