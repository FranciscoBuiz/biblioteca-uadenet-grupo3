import { formatMonto, HOY, nuevaOperacion } from "@/lib/domain/rules";
import type {
  MetodoPago,
  PaymentReceipt,
  PenaltyView,
} from "@/lib/domain/types";
import { demora, getDb, mutar } from "@/lib/store/db";
import {
  filtrarSanciones,
  vistaSancion,
  type FiltroSanciones,
} from "@/lib/store/selectors";
import { ApiError } from "./errors";
import { nuevaActividad, nuevaNotificacion } from "./internal";

/* ---------------------------------------------------------------
   GET  /api/v1/library/penalties
   POST /internal/v1/wallets/{userId}/debits
        { amount, currency: "ARS", concept: "LIBRARY_FINE",
          sourceModule: "library", externalReference: "penalty/{id}" }
   POST /internal/v1/events
        (eventType: library.penalty.applied.v1)
   --------------------------------------------------------------- */

export type { FiltroSanciones };

export async function getPenalties(
  filtro: FiltroSanciones = {},
): Promise<PenaltyView[]> {
  await demora();
  return filtrarSanciones(getDb(), filtro);
}

export async function getPenalty(id: string): Promise<PenaltyView> {
  await demora();
  const db = getDb();
  const sancion = db.sanciones.find((s) => s.id === id);
  if (!sancion) throw new ApiError("No encontramos esa sanción.", 404);
  return vistaSancion(db, sancion);
}

export const METODOS_PAGO: { id: MetodoPago; nombre: string; detalle: string }[] = [
  {
    id: "saldo",
    nombre: "Saldo institucional",
    detalle: "Se debita de tu cuenta UADEnet al confirmar.",
  },
  {
    id: "tarjeta",
    nombre: "Tarjeta de crédito o débito",
    detalle: "Pago en línea a través de la pasarela de la universidad.",
  },
  {
    id: "transferencia",
    nombre: "Transferencia bancaria",
    detalle: "Se acredita en 24 a 48 horas hábiles.",
  },
];

/**
 * Regulariza una multa.
 *
 * Contra el backend real esto dispara el debito en la wallet del alumno y el
 * evento library.penalty.applied.v1 descritos en el xlsx.
 */
export async function payPenalty(
  penaltyId: string,
  metodo: MetodoPago,
): Promise<PaymentReceipt> {
  await demora(320);

  const db = getDb();
  const sancion = db.sanciones.find((s) => s.id === penaltyId);
  if (!sancion) throw new ApiError("No encontramos esa sanción.", 404);
  if (sancion.estado === "cobrada") {
    throw new ApiError("Esta multa ya fue abonada.");
  }

  const libro = db.libros.find((l) => l.isbn === sancion.isbn);
  const estudiante = db.usuarios.find((u) => u.id === sancion.userId);

  const comprobante: PaymentReceipt = {
    operacion: nuevaOperacion(),
    penaltyId,
    monto: sancion.monto,
    metodo,
    fecha: HOY,
  };

  mutar((actual) => ({
    sanciones: actual.sanciones.map((s) =>
      s.id === penaltyId
        ? { ...s, estado: "cobrada" as const, fechaCobro: HOY }
        : s,
    ),
    notificaciones: [
      nuevaNotificacion(
        sancion.userId,
        "sancion",
        "Sanción regularizada",
        `Registramos el pago de ${formatMonto(sancion.monto)} por la multa ${penaltyId}. Ya podés volver a solicitar préstamos.`,
      ),
      ...actual.notificaciones,
    ],
    actividad: [
      nuevaActividad(
        "sancion",
        `Multa cobrada · ${penaltyId} — ${estudiante?.nombre ?? "Estudiante"}${libro ? ` (${libro.titulo})` : ""}`,
      ),
      ...actual.actividad,
    ],
  }));

  return comprobante;
}
