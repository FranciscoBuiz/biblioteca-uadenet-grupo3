import type {
  MetodoPago,
  PaymentReceipt,
  PenaltyView,
} from "@/lib/domain/types";
import {
  aComprobante,
  aVistaSancion,
  type PenaltyDto,
  type ReceiptDto,
} from "./adaptadores";
import { consulta, pedir } from "./http";

/* ---------------------------------------------------------------
   GET  /api/v1/library/penalties
   GET  /api/v1/library/penalties/{id}
   POST /api/v1/library/penalties/{id}/payments
   GET  /api/v1/wallets/me
   El backend filtra por el token: el estudiante ve solo lo propio.
   --------------------------------------------------------------- */

export interface FiltroSanciones {
  estado?: "todas" | "cobradas" | "pendientes";
  q?: string;
}

const ESTADO = { todas: "all", cobradas: "paid", pendientes: "pending" } as const;

export async function getPenalties(
  filtro: FiltroSanciones = {},
): Promise<PenaltyView[]> {
  const { estado, q } = filtro;
  const lista = await pedir<PenaltyDto[]>(
    "GET",
    `/penalties${consulta({ q: q?.trim(), status: estado && ESTADO[estado] })}`,
  );
  return lista.map(aVistaSancion);
}

export async function getPenalty(id: string): Promise<PenaltyView> {
  return aVistaSancion(await pedir<PenaltyDto>("GET", `/penalties/${encodeURIComponent(id)}`));
}

/** Saldo institucional del usuario, en pesos. */
export async function getSaldo(): Promise<number> {
  const { balance } = await pedir<{ balance: string }>("GET", "/api/v1/wallets/me");
  return Number(balance);
}

/** Unico medio de pago aceptado para las multas de la biblioteca. */
export const METODO_PAGO: { id: MetodoPago; nombre: string; detalle: string } = {
  id: "saldo",
  nombre: "Saldo institucional",
  detalle: "Se debita de tu cuenta UADEnet al confirmar.",
};

/** Regulariza una multa: el backend debita la wallet del alumno y emite el comprobante. */
export async function payPenalty(penaltyId: string): Promise<PaymentReceipt> {
  return aComprobante(
    await pedir<ReceiptDto>("POST", `/penalties/${encodeURIComponent(penaltyId)}/payments`),
  );
}
