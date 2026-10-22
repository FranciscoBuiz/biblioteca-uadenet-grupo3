import type { Repositorio } from "../datos/repositorio.js";
import type { FechaISO, Notification, TipoNotificacion } from "../dominio/tipos.js";
import { ErrorNegocio } from "./errores.js";
import { nuevoId } from "./comun.js";

export type FiltroNotificaciones = "todas" | "sin_leer" | "vencimientos" | "sanciones";

/** De la mas reciente a la mas vieja. */
export async function listarNotificaciones(
  repo: Repositorio,
  userId: string,
  filtro: FiltroNotificaciones = "todas",
): Promise<Notification[]> {
  const todas = (await repo.notificaciones(userId)).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id));
  if (filtro === "sin_leer") return todas.filter((n) => !n.leida);
  if (filtro === "vencimientos") return todas.filter((n) => n.tipo === "vencimiento");
  if (filtro === "sanciones") return todas.filter((n) => n.tipo === "sancion");
  return todas;
}

export async function marcarLeida(repo: Repositorio, userId: string, id: string): Promise<Notification> {
  const n = (await repo.notificaciones(userId)).find((x) => x.id === id);
  if (!n) throw new ErrorNegocio("NOT_FOUND", "No encontramos esa notificación.", 404);
  const leida = { ...n, leida: true };
  await repo.guardarNotificaciones([leida]);
  return leida;
}

export async function marcarTodasLeidas(repo: Repositorio, userId: string): Promise<void> {
  const pendientes = (await repo.notificaciones(userId)).filter((n) => !n.leida);
  await repo.guardarNotificaciones(pendientes.map((n) => ({ ...n, leida: true })));
}

export async function notificar(
  repo: Repositorio,
  userId: string,
  tipo: TipoNotificacion,
  titulo: string,
  cuerpo: string,
  hoy: FechaISO,
): Promise<void> {
  await repo.guardarNotificaciones([
    { id: nuevoId("NOT"), userId, tipo, titulo, cuerpo, fecha: hoy, leida: false },
  ]);
}
