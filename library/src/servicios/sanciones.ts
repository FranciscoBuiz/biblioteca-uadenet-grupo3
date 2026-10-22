import type { Repositorio } from "../datos/repositorio.js";
import { correspondeSancion, diasAtraso, formatMonto, MONTO_MULTA_INICIAL } from "../dominio/reglas.js";
import type { FechaISO, Loan, PaymentReceipt, Penalty, PenaltyView } from "../dominio/tipos.js";
import { CoreNoDisponible, SaldoInsuficiente } from "../integracion/core.js";
import { lectoresPorId, libroDesconocido, nombreDe, registrarActividad, type Contexto } from "./comun.js";
import { ErrorNegocio } from "./errores.js";
import { notificar } from "./notificaciones.js";

export interface FiltroSanciones {
  estado?: "todas" | "cobradas" | "pendientes";
  userId?: string;
  q?: string;
}

const noHaySancion = () => new ErrorNegocio("NOT_FOUND", "No encontramos esa sanción.", 404);

/** Tarifa con el vigenteDesde mas reciente que no sea futuro. */
export async function montoVigente(repo: Repositorio, hoy: FechaISO): Promise<number> {
  const vigentes = (await repo.tarifas()).filter((t) => t.vigenteDesde <= hoy);
  vigentes.sort((a, b) => b.vigenteDesde.localeCompare(a.vigenteDesde));
  return vigentes[0]?.monto ?? MONTO_MULTA_INICIAL;
}

/**
 * Crea la sancion dentro de una transaccion ya abierta (`r`). Devuelve null si
 * el prestamo ya tenia una o el atraso no llega al umbral. No publica el evento.
 */
export async function crearSancion(r: Repositorio, hoy: FechaISO, prestamo: Loan, nombre: string): Promise<Penalty | null> {
  if (!correspondeSancion(prestamo, hoy) || (await r.sancionDe(prestamo.id))) return null;
  const sancion: Penalty = {
    id: await r.siguienteId("sancion"),
    loanId: prestamo.id,
    userId: prestamo.userId,
    isbn: prestamo.isbn,
    monto: await montoVigente(r, hoy),
    diasAtraso: diasAtraso(prestamo, hoy),
    fechaLimiteOriginal: prestamo.fechaLimite,
    fechaDeteccion: hoy,
    fechaCobro: null,
    estado: "pendiente",
  };
  await r.guardarSancion(sancion);
  const titulo = (await r.libro(prestamo.isbn))?.titulo ?? "prestado";
  await notificar(
    r,
    prestamo.userId,
    "sancion",
    "Nueva sanción aplicada",
    `Se aplicó una multa de ${formatMonto(sancion.monto)} por la devolución tardía del libro ${titulo}.`,
    hoy,
  );
  await registrarActividad(r, "sancion", `Sanción generada · ${sancion.id} — ${nombre}`, hoy);
  return sancion;
}

/** Publica library.penalty.applied.v1; si falla, la sancion ya quedo guardada y solo se loguea. */
export async function publicarSancion(ctx: Contexto, sancion: Penalty): Promise<void> {
  try {
    await ctx.core.publicarEvento(
      {
        eventType: "library.penalty.applied.v1",
        source: "library",
        subject: `user/${sancion.userId}`,
        data: {
          userId: sancion.userId,
          loanId: sancion.loanId,
          daysLate: sancion.diasAtraso,
          amount: sancion.monto.toFixed(2),
          currency: "ARS",
        },
      },
      ctx.correlationId,
    );
  } catch (e) {
    console.error(`[${ctx.correlationId}] No se pudo publicar library.penalty.applied.v1 de ${sancion.id}:`, e);
  }
}

export async function aplicarSancion(ctx: Contexto, prestamo: Loan): Promise<Penalty | null> {
  const nombre = await nombreDe(ctx, prestamo.userId);
  const sancion = await ctx.repo.transaccion(async (r) => {
    const actual = await r.prestamo(prestamo.id);
    return actual ? crearSancion(r, ctx.hoy, actual, nombre) : null;
  });
  if (sancion) await publicarSancion(ctx, sancion);
  return sancion;
}

async function vistas(ctx: Contexto, sanciones: Penalty[]): Promise<PenaltyView[]> {
  const [libros, lector] = await Promise.all([ctx.repo.libros(), lectoresPorId(ctx, sanciones.map((s) => s.userId))]);
  return sanciones.map((s) => ({
    ...s,
    libro: libros.find((l) => l.isbn === s.isbn) ?? libroDesconocido(s.isbn),
    estudiante: lector(s.userId),
  }));
}

/** Las mas nuevas primero. */
export async function listarSanciones(ctx: Contexto, filtro: FiltroSanciones = {}): Promise<PenaltyView[]> {
  const { estado = "todas", userId, q = "" } = filtro;
  const texto = q.trim().toLowerCase();
  const soloDigitos = texto.replace(/\D/g, "");

  let sanciones = (await ctx.repo.sanciones()).filter((s) => !userId || s.userId === userId);
  if (estado === "cobradas") sanciones = sanciones.filter((s) => s.estado === "cobrada");
  else if (estado === "pendientes") sanciones = sanciones.filter((s) => s.estado === "pendiente");
  const resultado = (await vistas(ctx, sanciones)).sort((a, b) => b.id.localeCompare(a.id));

  if (!texto) return resultado;
  return resultado.filter(
    (s) =>
      s.id.toLowerCase().includes(texto) ||
      s.loanId.toLowerCase().includes(texto) ||
      s.isbn.includes(texto) ||
      s.libro.titulo.toLowerCase().includes(texto) ||
      s.estudiante.nombre.toLowerCase().includes(texto) ||
      (soloDigitos.length > 2 && s.estudiante.legajo.includes(soloDigitos)),
  );
}

/** Con userId (estudiante), una sancion ajena responde igual que una inexistente. */
export async function obtenerSancion(ctx: Contexto, id: string, userId?: string): Promise<PenaltyView> {
  const sancion = await ctx.repo.sancion(id);
  if (!sancion || (userId && sancion.userId !== userId)) throw noHaySancion();
  return (await vistas(ctx, [sancion]))[0];
}

export async function pagarSancion(ctx: Contexto, id: string, userId: string): Promise<PaymentReceipt> {
  const sancion = await ctx.repo.transaccion(async (r) => {
    const s = await r.sancion(id);
    if (!s || s.userId !== userId) throw noHaySancion();
    if (s.estado === "cobrada") throw new ErrorNegocio("ALREADY_PAID", "Esta multa ya fue abonada.", 409);
    return s;
  });

  // El debito va fuera de la transaccion; es idempotente por externalReference penalty/{id}.
  let operacion: string;
  try {
    ({ operacion } = await ctx.core.debitar(userId, sancion.monto, id, ctx.correlationId));
  } catch (e) {
    if (e instanceof SaldoInsuficiente) {
      throw new ErrorNegocio("INSUFFICIENT_FUNDS", "No tenés saldo suficiente en tu cuenta UADEnet para pagar esta multa.", 409);
    }
    if (e instanceof CoreNoDisponible) {
      throw new ErrorNegocio("CORE_UNAVAILABLE", "No pudimos procesar el pago en este momento. Intentá de nuevo en unos minutos.", 503);
    }
    throw e;
  }

  const nombre = await nombreDe(ctx, userId);
  return ctx.repo.transaccion(async (r) => {
    const actual = (await r.sancion(id)) ?? sancion;
    // Otro pedido en paralelo ya la marco: el CORE debito una sola vez, devolvemos el mismo comprobante.
    if (actual.estado === "cobrada") {
      return { operacion, penaltyId: id, monto: actual.monto, metodo: "saldo", fecha: actual.fechaCobro ?? ctx.hoy };
    }
    await r.guardarSancion({ ...actual, estado: "cobrada", fechaCobro: ctx.hoy });
    const libro = await r.libro(actual.isbn);
    await notificar(
      r,
      userId,
      "sancion",
      "Sanción regularizada",
      `Registramos el pago de ${formatMonto(actual.monto)} por la multa ${id}. Ya podés volver a solicitar préstamos.`,
      ctx.hoy,
    );
    await registrarActividad(r, "sancion", `Multa cobrada · ${id} — ${nombre}${libro ? ` (${libro.titulo})` : ""}`, ctx.hoy);
    return { operacion, penaltyId: id, monto: actual.monto, metodo: "saldo", fecha: ctx.hoy };
  });
}
