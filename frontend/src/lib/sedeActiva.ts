"use client";

import { useSyncExternalStore } from "react";
import type { SedeId } from "@/lib/domain/types";
import { useUsuario } from "@/lib/api/sesion";

/* Sede elegida en la cabecera. Vive en memoria: es una preferencia de la pestaña, no un dato del backend. */
let elegida: SedeId | null = null;
const oyentes = new Set<() => void>();

export function elegirSede(sede: SedeId): void {
  elegida = sede;
  oyentes.forEach((fn) => fn());
}

export function useSedeActiva(): SedeId {
  const usuario = useUsuario();
  const actual = useSyncExternalStore(
    (fn) => {
      oyentes.add(fn);
      return () => void oyentes.delete(fn);
    },
    () => elegida,
    () => null,
  );
  return actual ?? usuario?.sedeDefault ?? "monserrat";
}
