"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/* ---------------------------------------------------------------
   Modal del flujo de solicitud (pantalla 05) y de confirmaciones.

   Cierra con Escape y con clic en el fondo, bloquea el scroll de la
   pagina, mueve el foco al dialogo al abrirse y lo devuelve al
   elemento que lo disparo al cerrarse.
   --------------------------------------------------------------- */

export function Modal({
  abierto,
  onCerrar,
  titulo,
  bajada,
  children,
  acciones,
}: {
  abierto: boolean;
  onCerrar: () => void;
  titulo: string;
  bajada?: string;
  children: ReactNode;
  /** Botones del pie. */
  acciones?: ReactNode;
}) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const focoPrevio = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!abierto) return;

    focoPrevio.current = document.activeElement as HTMLElement | null;
    panel.current?.focus();

    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") onCerrar();
    };

    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", alTeclear);

    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflowPrevio;
      focoPrevio.current?.focus();
    };
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(16,24,40,0.45)] p-0 sm:items-center sm:p-6"
      onMouseDown={(evento) => {
        if (evento.target === evento.currentTarget) onCerrar();
      }}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-titulo`}
        aria-describedby={bajada ? `${id}-bajada` : undefined}
        tabIndex={-1}
        className="max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-t-hero bg-white p-6 shadow-ventana outline-none sm:rounded-hero sm:p-7"
      >
        <h2 id={`${id}-titulo`} className="serif text-[22px]">
          {titulo}
        </h2>
        {bajada && (
          <p id={`${id}-bajada`} className="mt-1.5 text-[13px] text-tenue">
            {bajada}
          </p>
        )}

        <div className="mt-5">{children}</div>

        {acciones && <div className="mt-6 flex flex-wrap gap-2.5">{acciones}</div>}
      </div>
    </div>
  );
}
