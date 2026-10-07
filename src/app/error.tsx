"use client";

import { useEffect } from "react";

/**
 * Limite de error de la aplicacion.
 *
 * Sin backend los errores esperables ya los maneja cada pantalla con un
 * <Aviso tono="error">; esto cubre lo imprevisto para que la demo nunca
 * termine en una pantalla en blanco.
 */
export default function ErrorApp({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-fondo px-5">
      <div className="w-full max-w-md text-center">
        <p className="eyebrow">Algo salió mal</p>
        <h1 className="serif mt-2 text-[28px]">No pudimos mostrar la pantalla</h1>
        <p className="mt-2 text-sm leading-relaxed text-tenue">
          Probá de nuevo. Si vuelve a pasar, reiniciá los datos de la demo
          borrando la clave <span className="font-mono">uadenet-biblioteca-v1</span>{" "}
          del almacenamiento local.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center justify-center rounded-[10px] bg-institucional px-[26px] py-[13px] text-sm font-semibold text-white transition-colors hover:bg-secundario"
        >
          Reintentar
        </button>
      </div>
    </div>
  );
}
