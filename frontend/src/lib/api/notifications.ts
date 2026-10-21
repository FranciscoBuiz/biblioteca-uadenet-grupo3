import type { Notification } from "@/lib/domain/types";
import { demora, getDb, mutar } from "@/lib/store/db";
import {
  filtrarNotificaciones,
  type FiltroNotificaciones,
} from "@/lib/store/selectors";

/* ---------------------------------------------------------------
   GET  /api/v1/library/notifications
   POST /api/v1/library/notifications/read

   El filtrado vive en lib/store/selectors: para leer desde un
   componente usa filtrarNotificaciones(db, userId, filtro) con el
   db que devuelve useDb(), que repinta solo.
   --------------------------------------------------------------- */

export type { FiltroNotificaciones };

export async function getNotifications(
  userId: string,
  filtro: FiltroNotificaciones = "todas",
): Promise<Notification[]> {
  await demora();
  return filtrarNotificaciones(getDb(), userId, filtro);
}

export async function markAllRead(userId: string): Promise<void> {
  mutar((db) => ({
    notificaciones: db.notificaciones.map((n) =>
      n.userId === userId ? { ...n, leida: true } : n,
    ),
  }));
}

export async function markRead(id: string): Promise<void> {
  mutar((db) => ({
    notificaciones: db.notificaciones.map((n) =>
      n.id === id ? { ...n, leida: true } : n,
    ),
  }));
}
