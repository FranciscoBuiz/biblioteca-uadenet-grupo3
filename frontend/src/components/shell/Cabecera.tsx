"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SEDES } from "@/lib/domain/rules";
import type { SedeId } from "@/lib/domain/types";
import { useUsuarioActual } from "@/lib/api/sesion";
import { elegirSede, useSedeActiva } from "@/lib/sedeActiva";
import { useDrawer } from "./AppShell";

/* ---------------------------------------------------------------
   Barra blanca superior de cada pantalla: migas de pan, titulo en
   serif, selector de sede y, para el estudiante, el desplegable de
   notificaciones.

   La renderiza cada pagina (y no el layout) porque el titulo y las
   migas son propios de la pantalla.
   --------------------------------------------------------------- */

export interface Miga {
  etiqueta: string;
  href?: string;
}

export function Cabecera({
  migas,
  titulo,
  acciones,
  children,
}: {
  /** Ej. [{etiqueta:"Biblioteca"},{etiqueta:"Catálogo",href:"/catalogo"}] */
  migas: Miga[];
  titulo: string;
  /** Controles propios de la pantalla, a la derecha. */
  acciones?: ReactNode;
  /** Slot extra, como el botón de notificaciones. */
  children?: ReactNode;
}) {
  const usuario = useUsuarioActual();

  return (
    <header className="sticky top-0 z-20 border-b border-borde bg-white px-4 py-3.5 sm:px-[30px]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
        <BotonMenu />
        <div className="min-w-0 flex-1">
          <nav aria-label="Ubicación" className="text-xs text-apagado">
            <ol className="flex flex-wrap items-center gap-1.5">
              {migas.map((miga, i) => (
                <li key={`${miga.etiqueta}-${i}`} className="flex items-center gap-1.5">
                  {i > 0 && <span aria-hidden>/</span>}
                  {miga.href ? (
                    <Link href={miga.href} className="hover:text-secundario">
                      {miga.etiqueta}
                    </Link>
                  ) : (
                    <span>{miga.etiqueta}</span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          <h1 className="serif mt-0.5 truncate text-lg sm:text-[21px]">
            {titulo}
          </h1>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {acciones}
          <SelectorSede />
          {usuario.rol === "estudiante" && children}
        </div>
      </div>
    </header>
  );
}

/** Abre el drawer con el menú lateral. Solo visible abajo de lg. */
function BotonMenu() {
  const drawer = useDrawer();
  if (!drawer) return null;

  return (
    <button
      type="button"
      onClick={drawer.abrir}
      aria-label="Abrir menú"
      className="-ml-1 shrink-0 rounded-nav p-2 text-grafito transition-colors hover:bg-borde-fino lg:hidden"
    >
      <svg
        aria-hidden
        viewBox="0 0 18 14"
        className="size-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      >
        <path d="M1 1h16M1 7h16M1 13h16" />
      </svg>
    </button>
  );
}

/** Pill "Sede: Monserrat" del mockup, convertida en selector real. */
export function SelectorSede() {
  const sedeActiva = useSedeActiva();

  return (
    <label className="relative hidden shrink-0 sm:block">
      <span className="sr-only">Sede activa</span>
      <select
        value={sedeActiva}
        onChange={(e) => elegirSede(e.target.value as SedeId)}
        className="cursor-pointer appearance-none rounded-full border border-borde-fuerte bg-white py-2 pl-4 pr-8 text-[13px] text-grafito hover:border-secundario"
      >
        {SEDES.map((sede) => (
          <option key={sede.id} value={sede.id}>
            Sede: {sede.nombre}
          </option>
        ))}
      </select>
      <svg
        aria-hidden
        viewBox="0 0 10 6"
        className="pointer-events-none absolute right-3 top-1/2 size-2.5 -translate-y-1/2 text-apagado"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M1 1l4 4 4-4" strokeLinecap="round" />
      </svg>
    </label>
  );
}

/** Contenedor con el padding de contenido de la maqueta (24px / 30px). */
export function Contenido({
  children,
  ancho = "normal",
}: {
  children: ReactNode;
  /** "angosto" para fichas y formularios de una sola columna. */
  ancho?: "normal" | "angosto";
}) {
  return (
    <div
      className={[
        "px-4 py-5 sm:px-[30px] sm:py-6",
        ancho === "angosto" ? "mx-auto w-full max-w-[720px]" : "",
      ].join(" ")}
    >
      {children}
    </div>
  );
}
