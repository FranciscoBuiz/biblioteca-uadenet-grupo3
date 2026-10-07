"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { markAllRead } from "@/lib/api/notifications";
import { formatFecha } from "@/lib/domain/rules";
import type { Notification, TipoNotificacion } from "@/lib/domain/types";
import { useDb } from "@/lib/store/LibraryProvider";
import { notificacionesDe, sinLeer } from "@/lib/store/selectors";

/* ---------------------------------------------------------------
   Pantalla 12: desplegable de notificaciones del header, disponible
   desde cualquier pantalla del estudiante.
   --------------------------------------------------------------- */

/** Color del punto segun el tipo de aviso. */
const PUNTO: Record<TipoNotificacion, string> = {
  sancion: "bg-rojo",
  vencimiento: "bg-alerta-fg",
  comprobante: "bg-secundario",
};

export function BotonNotificaciones({ userId }: { userId: string }) {
  const db = useDb();
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);

  const notificaciones = notificacionesDe(db, userId);
  const noLeidas = sinLeer(db, userId);

  useEffect(() => {
    if (!abierto) return;

    const alClicFuera = (evento: MouseEvent) => {
      if (!contenedor.current?.contains(evento.target as Node)) {
        setAbierto(false);
      }
    };
    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setAbierto(false);
    };

    document.addEventListener("mousedown", alClicFuera);
    document.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("mousedown", alClicFuera);
      document.removeEventListener("keydown", alTeclear);
    };
  }, [abierto]);

  return (
    <div ref={contenedor} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        aria-haspopup="true"
        className="flex items-center gap-1.5 rounded-full border border-borde-fuerte bg-white px-4 py-2 text-[13px] font-medium transition-colors hover:border-secundario"
      >
        <span className="hidden sm:inline">Notificaciones</span>
        <CampanaIcono />
        {noLeidas > 0 && (
          <span className="rounded-full bg-rojo px-1.5 py-px text-[11px] font-semibold text-white">
            {noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Notificaciones recientes"
          className="absolute right-0 z-40 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-tarjeta border border-borde bg-white shadow-ventana"
        >
          <div className="flex items-center justify-between gap-3 border-b border-borde-suave px-4 py-3">
            <span className="text-sm font-semibold">Notificaciones</span>
            {noLeidas > 0 && (
              <button
                type="button"
                onClick={() => markAllRead(userId)}
                className="text-xs font-semibold text-secundario hover:text-institucional"
              >
                Marcar leídas
              </button>
            )}
          </div>

          {notificaciones.length === 0 ? (
            <p className="px-4 py-8 text-center text-[13px] text-tenue">
              No tenés notificaciones.
            </p>
          ) : (
            <ul className="max-h-[340px] divide-y divide-borde-fino overflow-y-auto">
              {notificaciones.slice(0, 5).map((n) => (
                <li key={n.id}>
                  <FilaNotificacion notificacion={n} />
                </li>
              ))}
            </ul>
          )}

          <Link
            href="/notificaciones"
            onClick={() => setAbierto(false)}
            className="block border-t border-borde-suave px-4 py-3 text-center text-[13px] font-semibold text-secundario hover:bg-aviso-bg"
          >
            Ver todas las notificaciones
          </Link>
        </div>
      )}
    </div>
  );
}

export function FilaNotificacion({
  notificacion,
}: {
  notificacion: Notification;
}) {
  return (
    <div
      className={[
        "px-4 py-3",
        notificacion.leida ? "" : "bg-aviso-bg",
      ].join(" ")}
    >
      <div className="flex items-center gap-2">
        <span
          aria-hidden
          className={`size-[7px] shrink-0 rounded-full ${PUNTO[notificacion.tipo]}`}
        />
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold">
          {notificacion.titulo}
        </span>
        {!notificacion.leida && (
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-secundario">
            Sin leer
          </span>
        )}
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-tenue">
        {notificacion.cuerpo}
      </p>
      <p className="mt-1.5 text-[11px] text-apagado">
        {formatFecha(notificacion.fecha)}
      </p>
    </div>
  );
}

function CampanaIcono() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
    >
      <path d="M4 7a4 4 0 0 1 8 0c0 2.2.5 3.4 1 4H3c.5-.6 1-1.8 1-4Z" />
      <path d="M6.5 13a1.6 1.6 0 0 0 3 0" />
    </svg>
  );
}
