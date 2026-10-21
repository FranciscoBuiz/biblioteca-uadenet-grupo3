import { randomUUID } from "node:crypto";
import { LECTORES } from "./usuarios.js";

// u-camila es la estudiante sin saldo (sirve para probar el rechazo por fondos insuficientes).
const inicial = (id: string) => (id === "u-ana" ? 500000 : id === "u-laura" || id === "u-camila" ? 0 : 250000);
const saldos = new Map<string, number>(LECTORES.map((l) => [l.id, inicial(l.id)])); // centavos
const operaciones = new Map<string, string>(); // externalReference -> operationId

export const formato = (centavos: number) => (centavos / 100).toFixed(2);
export const saldoDe = (userId: string) => saldos.get(userId);

export type ResultadoDebito =
  | { estado: "ok"; operationId: string; balance: string }
  | { estado: "repetido"; operationId: string; balance: string }
  | { estado: "sin_fondos" }
  | { estado: "sin_usuario" };

export function debitar(userId: string, monto: string, externalReference: string): ResultadoDebito {
  const saldo = saldos.get(userId);
  if (saldo === undefined) return { estado: "sin_usuario" };
  const previa = operaciones.get(externalReference);
  if (previa) return { estado: "repetido", operationId: previa, balance: formato(saldo) };
  const centavos = Math.round(Number(monto) * 100);
  if (saldo < centavos) return { estado: "sin_fondos" };
  saldos.set(userId, saldo - centavos);
  const operationId = `OP-${randomUUID()}`;
  operaciones.set(externalReference, operationId);
  return { estado: "ok", operationId, balance: formato(saldo - centavos) };
}
