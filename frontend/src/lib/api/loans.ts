import {
  calcularFechaLimite,
  correspondeSancion,
  diasAtraso,
  DIAS_RENOVACION,
  formatFecha,
  HOY,
  MONTO_MULTA,
  nombreSede,
  nuevoCodigoRetiro,
  puedeRenovar,
  sumarDias,
} from "@/lib/domain/rules";
import type { Loan, LoanView, Penalty, SedeId } from "@/lib/domain/types";
import { demora, getDb, mutar } from "@/lib/store/db";
import {
  filtrarPrestamos,
  prestamosVencidos,
  tieneSancionPendiente,
  vistaPrestamo,
  type FiltroPrestamos,
} from "@/lib/store/selectors";
import { ApiError } from "./errors";
import { nuevaActividad, nuevaNotificacion } from "./internal";

/* ---------------------------------------------------------------
   GET  /api/v1/library/loans
   POST /api/v1/library/loans
   POST /api/v1/library/loans/{id}/renew
   POST /api/v1/library/loans/{id}/return
   --------------------------------------------------------------- */

export type { FiltroPrestamos };

export async function getLoans(
  filtro: FiltroPrestamos = {},
): Promise<LoanView[]> {
  await demora();
  return filtrarPrestamos(getDb(), filtro);
}

export async function getLoan(id: string): Promise<LoanView> {
  await demora();
  const db = getDb();
  const prestamo = db.prestamos.find((p) => p.id === id);
  if (!prestamo) throw new ApiError("No encontramos ese préstamo.", 404);
  return vistaPrestamo(db, prestamo);
}

export async function getOverdueLoans(): Promise<LoanView[]> {
  await demora();
  return prestamosVencidos(getDb());
}

/**
 * Genera un prestamo: reserva el primer ejemplar disponible en la sede,
 * calcula la fecha limite a 14 dias y emite el codigo de retiro.
 */
export async function createLoan(
  isbn: string,
  sede: SedeId,
  userId: string,
): Promise<Loan> {
  await demora(260);

  const db = getDb();

  const libro = db.libros.find((l) => l.isbn === isbn);
  if (!libro) throw new ApiError("No encontramos ese título.", 404);
  if (!libro.activo) {
    throw new ApiError("El título está dado de baja y no se puede solicitar.");
  }

  if (tieneSancionPendiente(db, userId)) {
    throw new ApiError(
      "Tenés una sanción pendiente de pago. Regularizá la multa para volver a solicitar préstamos.",
    );
  }

  const yaLoTiene = db.prestamos.some(
    (p) => p.userId === userId && p.isbn === isbn && !p.fechaDevolucion,
  );
  if (yaLoTiene) {
    throw new ApiError("Ya tenés un préstamo activo de este título.");
  }

  const ejemplar = db.ejemplares.find(
    (e) => e.isbn === isbn && e.sede === sede && e.estado === "disponible",
  );
  if (!ejemplar) {
    throw new ApiError(
      `No hay ejemplares disponibles de ${libro.titulo} en ${nombreSede(sede)}.`,
    );
  }

  const prestamo: Loan = {
    id: `PRE-${db.secuencias.prestamo}`,
    isbn,
    copia: ejemplar.codigo,
    userId,
    sede,
    fechaPrestamo: HOY,
    fechaLimite: calcularFechaLimite(HOY),
    fechaDevolucion: null,
    renovaciones: 0,
    codigoRetiro: nuevoCodigoRetiro(),
    tieneReservas: false,
  };

  const estudiante = db.usuarios.find((u) => u.id === userId);

  mutar((actual) => ({
    prestamos: [...actual.prestamos, prestamo],
    ejemplares: actual.ejemplares.map((e) =>
      e.codigo === ejemplar.codigo ? { ...e, estado: "prestado" as const } : e,
    ),
    secuencias: { ...actual.secuencias, prestamo: actual.secuencias.prestamo + 1 },
    notificaciones: [
      nuevaNotificacion(
        userId,
        "comprobante",
        "Comprobante disponible",
        `Tu préstamo ${prestamo.id} fue registrado. Retiralo en sede ${nombreSede(sede)} hasta el ${formatFecha(prestamo.fechaLimite)}.`,
      ),
      ...actual.notificaciones,
    ],
    actividad: [
      nuevaActividad(
        "prestamo",
        `Nuevo préstamo · ${libro.titulo} — ${estudiante?.nombre ?? "Estudiante"}`,
      ),
      ...actual.actividad,
    ],
  }));

  return prestamo;
}

/** Extiende la fecha limite 3 dias si el prestamo admite renovacion. */
export async function renewLoan(id: string): Promise<Loan> {
  await demora();

  const db = getDb();
  const prestamo = db.prestamos.find((p) => p.id === id);
  if (!prestamo) throw new ApiError("No encontramos ese préstamo.", 404);

  const sancion = db.sanciones.find((s) => s.loanId === id) ?? null;
  const evaluacion = puedeRenovar(prestamo, sancion);
  if (!evaluacion.puede) throw new ApiError(evaluacion.motivo);

  const renovado: Loan = {
    ...prestamo,
    fechaLimite: sumarDias(prestamo.fechaLimite, DIAS_RENOVACION),
    renovaciones: prestamo.renovaciones + 1,
  };

  mutar((actual) => ({
    prestamos: actual.prestamos.map((p) => (p.id === id ? renovado : p)),
    notificaciones: [
      nuevaNotificacion(
        prestamo.userId,
        "vencimiento",
        "Préstamo renovado",
        `${db.libros.find((l) => l.isbn === prestamo.isbn)?.titulo ?? "El título"} ahora vence el ${formatFecha(renovado.fechaLimite)}.`,
      ),
      ...actual.notificaciones,
    ],
  }));

  return renovado;
}

export interface ResultadoDevolucion {
  prestamo: Loan;
  /** Sancion recien generada, o null si la devolucion entro en plazo. */
  sancion: Penalty | null;
}

/**
 * Cierra el prestamo en el mostrador: libera el ejemplar y, si el atraso
 * alcanza los 8 dias, genera la sancion con la multa correspondiente.
 */
export async function returnLoan(id: string): Promise<ResultadoDevolucion> {
  await demora(260);

  const db = getDb();
  const prestamo = db.prestamos.find((p) => p.id === id);
  if (!prestamo) throw new ApiError("No encontramos ese préstamo.", 404);
  if (prestamo.fechaDevolucion) {
    throw new ApiError("Este préstamo ya fue devuelto.");
  }

  const libro = db.libros.find((l) => l.isbn === prestamo.isbn);
  const estudiante = db.usuarios.find((u) => u.id === prestamo.userId);
  const atraso = diasAtraso(prestamo);
  const yaTieneSancion = db.sanciones.some((s) => s.loanId === id);

  const devuelto: Loan = { ...prestamo, fechaDevolucion: HOY };

  const sancion: Penalty | null =
    correspondeSancion(prestamo) && !yaTieneSancion
      ? {
          id: `SAN-${String(db.secuencias.sancion).padStart(5, "0")}`,
          loanId: id,
          userId: prestamo.userId,
          isbn: prestamo.isbn,
          monto: MONTO_MULTA,
          diasAtraso: atraso,
          fechaLimiteOriginal: prestamo.fechaLimite,
          fechaDeteccion: HOY,
          fechaCobro: null,
          estado: "pendiente",
        }
      : null;

  mutar((actual) => ({
    prestamos: actual.prestamos.map((p) => (p.id === id ? devuelto : p)),
    ejemplares: actual.ejemplares.map((e) =>
      e.codigo === prestamo.copia ? { ...e, estado: "disponible" as const } : e,
    ),
    sanciones: sancion ? [...actual.sanciones, sancion] : actual.sanciones,
    secuencias: sancion
      ? { ...actual.secuencias, sancion: actual.secuencias.sancion + 1 }
      : actual.secuencias,
    notificaciones: [
      ...(sancion
        ? [
            nuevaNotificacion(
              prestamo.userId,
              "sancion",
              "Nueva sanción aplicada",
              `Se aplicó una multa de $${MONTO_MULTA.toLocaleString("es-AR")} por la devolución tardía del libro ${libro?.titulo ?? "prestado"}.`,
            ),
          ]
        : []),
      nuevaNotificacion(
        prestamo.userId,
        "comprobante",
        "Devolución registrada",
        `Recibimos ${libro?.titulo ?? "el libro"} en sede ${nombreSede(prestamo.sede)}. El préstamo ${id} quedó cerrado.`,
      ),
      ...actual.notificaciones,
    ],
    actividad: [
      ...(sancion
        ? [nuevaActividad("sancion", `Sanción generada · ${sancion.id} — ${estudiante?.nombre ?? "Estudiante"}`)]
        : []),
      nuevaActividad(
        "devolucion",
        `Devolución registrada · ${libro?.titulo ?? "Libro"} — ${estudiante?.nombre ?? "Estudiante"}`,
      ),
      ...actual.actividad,
    ],
  }));

  return { prestamo: devuelto, sancion };
}
