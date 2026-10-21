import { randomUUID } from "node:crypto";
import type { Repositorio } from "../datos/repositorio.js";
import type { FechaISO, TipoActividad } from "../dominio/tipos.js";

/** Id unico y legible: dos llamadas en el mismo instante no colisionan. */
export function nuevoId(prefijo: string): string {
  return `${prefijo}-${randomUUID()}`;
}

function horaActual(): string {
  const ahora = new Date();
  return `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
}

export async function registrarActividad(
  repo: Repositorio,
  tipo: TipoActividad,
  texto: string,
  hoy: FechaISO,
): Promise<void> {
  await repo.registrarActividad({ id: nuevoId("ACT"), tipo, texto, fecha: hoy, hora: horaActual() });
}
