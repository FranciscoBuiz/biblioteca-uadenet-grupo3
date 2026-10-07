"use client";

import type { ReactNode } from "react";

/* ---------------------------------------------------------------
   Controles de filtrado de la maqueta.

   Pestanas: 8px 16px, pill, activa en #1A2B4B sobre blanco.
   Chips de categoria: 6px 14px, 12px.
   Toggle "Solo con stock": activo en verde #127453.
   Buscador: fondo #F1F3F6, pill, 11px 18px.
   --------------------------------------------------------------- */

export interface Opcion<T extends string> {
  id: T;
  etiqueta: string;
  /** Contador opcional a la derecha de la etiqueta. */
  cantidad?: number;
}

/** Pestanas tipo Activos / Vencidos / Devueltos / Todos. */
export function Tabs<T extends string>({
  opciones,
  valor,
  onChange,
  etiquetaGrupo = "Filtrar por estado",
}: {
  opciones: Opcion<T>[];
  valor: T;
  onChange: (valor: T) => void;
  etiquetaGrupo?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={etiquetaGrupo}
      className="scroll-fino -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
    >
      {opciones.map((opcion) => {
        const activa = opcion.id === valor;
        return (
          <button
            key={opcion.id}
            type="button"
            role="tab"
            aria-selected={activa}
            onClick={() => onChange(opcion.id)}
            className={[
              "shrink-0 rounded-full px-4 py-2 text-[13px] font-semibold transition-colors",
              activa
                ? "bg-institucional text-white"
                : "border border-borde-fuerte bg-white text-grafito hover:border-secundario",
            ].join(" ")}
          >
            {opcion.etiqueta}
            {opcion.cantidad !== undefined && (
              <span className={activa ? "ml-1.5 text-sidebar-texto" : "ml-1.5 text-apagado"}>
                {opcion.cantidad}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Chips de categoria del catalogo. */
export function Chips<T extends string>({
  opciones,
  valor,
  onChange,
  etiquetaGrupo = "Filtrar por categoría",
}: {
  opciones: Opcion<T>[];
  valor: T;
  onChange: (valor: T) => void;
  etiquetaGrupo?: string;
}) {
  return (
    <div
      role="group"
      aria-label={etiquetaGrupo}
      className="flex flex-wrap gap-2"
    >
      {opciones.map((opcion) => {
        const activa = opcion.id === valor;
        return (
          <button
            key={opcion.id}
            type="button"
            aria-pressed={activa}
            onClick={() => onChange(opcion.id)}
            className={[
              "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
              activa
                ? "bg-institucional text-white"
                : "border border-borde-fuerte bg-white text-grafito hover:border-secundario",
            ].join(" ")}
          >
            {opcion.etiqueta}
          </button>
        );
      })}
    </div>
  );
}

/** Buscador con fondo gris y forma de pill. */
export function Buscador({
  valor,
  onChange,
  placeholder,
  etiqueta,
}: {
  valor: string;
  onChange: (valor: string) => void;
  placeholder: string;
  /** Label accesible; si no viene se usa el placeholder. */
  etiqueta?: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-full bg-borde-fino px-4 py-2.5">
      <LupaIcono />
      <input
        type="search"
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={etiqueta ?? placeholder}
        className="min-w-0 flex-1 bg-transparent text-sm text-institucional outline-none placeholder:text-apagado"
      />
      {valor && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Limpiar búsqueda"
          className="text-xs font-semibold text-apagado hover:text-institucional"
        >
          Limpiar
        </button>
      )}
    </div>
  );
}

function LupaIcono() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="size-4 shrink-0 text-apagado"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <circle cx="6.8" cy="6.8" r="4.6" />
      <path d="M10.4 10.4 14 14" strokeLinecap="round" />
    </svg>
  );
}

/** Interruptor con forma de pill, verde cuando esta activo. */
export function Toggle({
  activo,
  onChange,
  children,
}: {
  activo: boolean;
  onChange: (activo: boolean) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={activo}
      onClick={() => onChange(!activo)}
      className={[
        "shrink-0 rounded-full px-4 py-2.5 text-[13px] font-semibold transition-colors",
        activo
          ? "border border-verde bg-verde text-white"
          : "border border-borde-fuerte bg-white text-grafito hover:border-secundario",
      ].join(" ")}
    >
      {children}
    </button>
  );
}

/**
 * Desplegable con forma de pill, como el "Sede: Monserrat" del header.
 * Usa un <select> nativo para que funcione bien con teclado y en mobile.
 */
export function SelectPill<T extends string>({
  etiqueta,
  valor,
  opciones,
  onChange,
}: {
  etiqueta: string;
  valor: T;
  opciones: Opcion<T>[];
  onChange: (valor: T) => void;
}) {
  return (
    <label className="relative shrink-0">
      <span className="sr-only">{etiqueta}</span>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value as T)}
        className="cursor-pointer appearance-none rounded-full border border-borde-fuerte bg-white py-2.5 pl-4 pr-9 text-[13px] text-grafito hover:border-secundario"
      >
        {opciones.map((opcion) => (
          <option key={opcion.id} value={opcion.id}>
            {etiqueta}: {opcion.etiqueta}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 10 6"
        className="pointer-events-none absolute right-3.5 top-1/2 size-2.5 -translate-y-1/2 text-apagado"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M1 1l4 4 4-4" strokeLinecap="round" />
      </svg>
    </label>
  );
}

/** Barra de herramientas: buscador a la izquierda y filtros a la derecha. */
export function BarraFiltros({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">{children}</div>
  );
}
