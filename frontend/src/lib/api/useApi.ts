"use client";

import { useCallback, useEffect, useState } from "react";
import { mensajeDeError } from "./errors";
import { suscribirInvalidacion } from "./http";

/**
 * Carga datos del backend. Vuelve a pedir cuando cambian `deps`, cuando
 * una mutacion llama a invalidar() o con `recargar()`. Descarta respuestas
 * viejas y no toca el estado despues de desmontar.
 */
export function useApi<T>(
  carga: () => Promise<T>,
  deps: unknown[],
): { datos: T | undefined; error: string | null; cargando: boolean; recargar: () => void } {
  const [datos, setDatos] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const [version, setVersion] = useState(0);

  const recargar = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => suscribirInvalidacion(recargar), [recargar]);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    carga().then(
      (d) => {
        if (!vigente) return;
        setDatos(d);
        setError(null);
        setCargando(false);
      },
      (e: unknown) => {
        if (!vigente) return;
        setError(mensajeDeError(e));
        setCargando(false);
      },
    );
    // Al cambiar deps o desmontar, la respuesta en vuelo queda obsoleta.
    return () => {
      vigente = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, version]);

  return { datos, error, cargando, recargar };
}
