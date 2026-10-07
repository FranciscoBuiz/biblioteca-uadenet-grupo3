"use client";

import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/* ---------------------------------------------------------------
   Botones de la maqueta.

   Las variantes salen tal cual de los mockups: verde #127453 para
   la accion que confirma, azul #2D5DA1 para acciones secundarias de
   avance, azul institucional #1A2B4B relleno o con borde para la
   navegacion principal, blanco con borde gris para volver, y la
   forma "pill" para las acciones de las barras de herramientas.
   --------------------------------------------------------------- */

export type VarianteBoton =
  | "confirmar"
  | "avanzar"
  | "institucional"
  | "contorno"
  | "neutro"
  | "peligro"
  | "texto";

export type TamanoBoton = "normal" | "chico" | "pill";

const VARIANTES: Record<VarianteBoton, string> = {
  confirmar: "bg-verde text-white hover:bg-[#0e5c43]",
  avanzar: "bg-secundario text-white hover:bg-institucional",
  institucional: "bg-institucional text-white hover:bg-secundario",
  contorno:
    "bg-white text-institucional border border-institucional hover:bg-institucional hover:text-white",
  neutro:
    "bg-white text-institucional border border-borde-fuerte hover:bg-[#F1F3F6]",
  peligro: "bg-white text-rojo border border-[#F2C9C9] hover:bg-error-bg",
  texto: "bg-transparent text-secundario hover:text-institucional",
};

const TAMANOS: Record<TamanoBoton, string> = {
  normal: "px-[26px] py-[13px] text-sm rounded-[10px]",
  chico: "px-[22px] py-3 text-[13px] rounded-[10px]",
  pill: "px-5 py-[11px] text-[13px] rounded-full",
};

const BASE =
  "inline-flex items-center justify-center gap-2 font-semibold leading-none " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-50";

interface Comunes {
  variante?: VarianteBoton;
  tamano?: TamanoBoton;
  /** Ocupa todo el ancho disponible. */
  ancho?: boolean;
  children: ReactNode;
}

type PropsBoton = Comunes &
  Omit<ComponentProps<"button">, "children" | "className"> & {
    cargando?: boolean;
  };

export function Boton({
  variante = "confirmar",
  tamano = "normal",
  ancho = false,
  cargando = false,
  disabled,
  children,
  ...resto
}: PropsBoton) {
  return (
    <button
      type="button"
      disabled={disabled || cargando}
      aria-busy={cargando || undefined}
      className={[
        BASE,
        VARIANTES[variante],
        TAMANOS[tamano],
        ancho ? "w-full" : "",
      ].join(" ")}
      {...resto}
    >
      {cargando && <Spinner />}
      {children}
    </button>
  );
}

type PropsBotonLink = Comunes &
  Omit<ComponentProps<typeof Link>, "children" | "className">;

/** Mismo aspecto que Boton pero navega. */
export function BotonLink({
  variante = "neutro",
  tamano = "normal",
  ancho = false,
  children,
  ...resto
}: PropsBotonLink) {
  return (
    <Link
      className={[
        BASE,
        VARIANTES[variante],
        TAMANOS[tamano],
        ancho ? "w-full" : "",
      ].join(" ")}
      {...resto}
    >
      {children}
    </Link>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      className="size-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
    />
  );
}
