"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import type { Rol, User } from "@/lib/domain/types";
import { leerSesion, suscribirSesion } from "./http";

/* ---------------------------------------------------------------
   Sesion del usuario (JWT en sessionStorage). Reemplaza a
   LibraryProvider con los mismos nombres de hooks.

   El render se bloquea hasta hidratar para que el HTML del servidor
   (sin sesion) y el del cliente coincidan.
   --------------------------------------------------------------- */

export function SesionProvider({ children }: { children: React.ReactNode }) {
  const [hidratado, setHidratado] = useState(false);
  useEffect(() => setHidratado(true), []);

  if (!hidratado) return <PantallaCargando />;
  return <>{children}</>;
}

function PantallaCargando() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-fondo">
      <div className="text-center">
        <div className="serif text-2xl text-institucional">UADEnet</div>
        <div className="eyebrow mt-1">Biblioteca</div>
        <div
          className="mx-auto mt-5 h-1 w-28 overflow-hidden rounded-full bg-borde"
          role="status"
          aria-label="Cargando"
        >
          <div className="h-full w-1/3 animate-pulse rounded-full bg-secundario" />
        </div>
      </div>
    </div>
  );
}

/** Usuario de la sesión actual, o null si nadie inició sesión. */
export function useUsuario(): User | null {
  return useSyncExternalStore(
    suscribirSesion,
    () => leerSesion()?.usuario ?? null,
    () => null,
  );
}

/**
 * Usuario de la sesión dentro de un área protegida.
 *
 * Los layouts de (student) y (admin) ya cortan el acceso con <Guard>, así que
 * cuando un componente de pantalla corre, la sesión existe.
 */
export function useUsuarioActual(): User {
  const usuario = useUsuario();
  if (!usuario) {
    throw new Error("No hay sesión activa: falta el <Guard> en el layout.");
  }
  return usuario;
}

export function useRol(): Rol | null {
  return useUsuario()?.rol ?? null;
}
