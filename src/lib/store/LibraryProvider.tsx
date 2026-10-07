"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useSyncExternalStore,
} from "react";
import type { Rol, User } from "@/lib/domain/types";
import { getDb, hidratar, suscribir, type Db } from "./db";

/* ---------------------------------------------------------------
   Puente entre la base en memoria y React.

   No guarda estado propio: se suscribe al store con
   useSyncExternalStore, asi cualquier mutacion hecha desde lib/api
   repinta las pantallas que la esten mirando.

   El render se bloquea hasta terminar de leer localStorage para que
   el HTML del servidor y el del cliente coincidan.
   --------------------------------------------------------------- */

const ContextoDb = createContext<Db | null>(null);

export function LibraryProvider({ children }: { children: React.ReactNode }) {
  const [hidratado, setHidratado] = useState(false);

  useEffect(() => {
    hidratar();
    setHidratado(true);
  }, []);

  const db = useSyncExternalStore(suscribir, getDb, getDb);

  if (!hidratado) return <PantallaCargando />;

  return <ContextoDb.Provider value={db}>{children}</ContextoDb.Provider>;
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

/** Estado completo de la base. Repinta ante cualquier cambio. */
export function useDb(): Db {
  const db = useContext(ContextoDb);
  if (!db) {
    throw new Error("useDb debe usarse dentro de <LibraryProvider>.");
  }
  return db;
}

/** Usuario de la sesión actual, o null si nadie inició sesión. */
export function useUsuario(): User | null {
  const db = useDb();
  if (!db.sesion) return null;
  return db.usuarios.find((u) => u.id === db.sesion) ?? null;
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
