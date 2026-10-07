import { HOY } from "@/lib/domain/rules";
import type {
  Activity,
  Notification,
  TipoActividad,
  TipoNotificacion,
} from "@/lib/domain/types";

/* ---------------------------------------------------------------
   Efectos secundarios que en el sistema real dispararia el backend:
   el feed de actividad del bibliotecario y las notificaciones del
   estudiante (library.penalty.applied.v1 y companía, segun el xlsx).
   --------------------------------------------------------------- */

export function horaActual(): string {
  const ahora = new Date();
  const hh = String(ahora.getHours()).padStart(2, "0");
  const mm = String(ahora.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/** Id unico y legible para registros creados durante la demo. */
function nuevoId(prefijo: string): string {
  return `${prefijo}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
}

export function nuevaActividad(tipo: TipoActividad, texto: string): Activity {
  return {
    id: nuevoId("ACT"),
    tipo,
    texto,
    fecha: HOY,
    hora: horaActual(),
  };
}

export function nuevaNotificacion(
  userId: string,
  tipo: TipoNotificacion,
  titulo: string,
  cuerpo: string,
): Notification {
  return {
    id: nuevoId("NOT"),
    userId,
    tipo,
    titulo,
    cuerpo,
    fecha: HOY,
    leida: false,
  };
}
