import type { Notification } from "@/lib/domain/types";
import { aNotificacion, type NotificationDto } from "./adaptadores";
import { leerSesion, pedir } from "./http";

/* ---------------------------------------------------------------
   GET   /api/v1/library/notifications?filter=unread
   POST  /api/v1/library/notifications/read-all
   PATCH /api/v1/library/notifications/{id}
   El backend filtra por el token.
   --------------------------------------------------------------- */

export type FiltroNotificaciones =
  | "todas"
  | "sin_leer"
  | "vencimientos"
  | "sanciones";

const FILTRO = {
  todas: "all",
  sin_leer: "unread",
  vencimientos: "dueDates",
  sanciones: "penalties",
} as const;

const propietario = () => leerSesion()?.usuario.id ?? "";

export async function getNotifications(
  filtro: FiltroNotificaciones = "todas",
): Promise<Notification[]> {
  const lista = await pedir<NotificationDto[]>("GET", `/notifications?filter=${FILTRO[filtro]}`);
  return lista.map((n) => aNotificacion(n, propietario()));
}

export async function getUnreadCount(): Promise<number> {
  return (await getNotifications("sin_leer")).length;
}

export async function markAllRead(): Promise<void> {
  await pedir<NotificationDto[]>("POST", "/notifications/read-all");
}

export async function markRead(id: string): Promise<void> {
  await pedir<NotificationDto>("PATCH", `/notifications/${encodeURIComponent(id)}`, { read: true });
}
