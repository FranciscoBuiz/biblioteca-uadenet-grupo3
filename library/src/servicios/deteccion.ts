import { correspondeSancion } from "../dominio/reglas.js";
import type { Penalty } from "../dominio/tipos.js";
import type { Contexto } from "./comun.js";
import { aplicarSancion } from "./sanciones.js";

/**
 * Recorre los prestamos abiertos y sanciona los que llegaron a 8 dias de atraso.
 * Idempotente: aplicarSancion vuelve a chequear sancionDe dentro de su transaccion.
 */
export async function detectarAtrasos(ctx: Contexto): Promise<Penalty[]> {
  const candidatos = (await ctx.repo.prestamos())
    .filter((p) => !p.fechaDevolucion && correspondeSancion(p, ctx.hoy))
    .sort((a, b) => a.id.localeCompare(b.id));
  const nuevas: Penalty[] = [];
  for (const prestamo of candidatos) {
    const sancion = await aplicarSancion(ctx, prestamo);
    if (sancion) nuevas.push(sancion);
  }
  return nuevas;
}
