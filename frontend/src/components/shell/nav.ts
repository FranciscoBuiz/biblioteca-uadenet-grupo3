import type { Rol } from "@/lib/domain/types";

/* ---------------------------------------------------------------
   Menu lateral de cada perfil, en el orden de la maqueta.

   Estudiante: Inicio, Catalogo, Mis prestamos, Sanciones.
   Bibliotecario: Inicio, Catalogo, Stock por sede, Prestamos,
   Devoluciones, Sanciones.
   --------------------------------------------------------------- */

export interface ItemNav {
  href: string;
  etiqueta: string;
  /** De dónde sale el badge numérico del item, si lo tiene. */
  badge?: "prestamos" | "sanciones" | "vencidos";
  /** Etiqueta corta para la barra inferior de mobile. */
  corta?: string;
}

export const NAV_ESTUDIANTE: ItemNav[] = [
  { href: "/inicio", etiqueta: "Inicio" },
  { href: "/catalogo", etiqueta: "Catálogo" },
  { href: "/prestamos", etiqueta: "Mis préstamos", badge: "prestamos", corta: "Préstamos" },
  { href: "/sanciones", etiqueta: "Sanciones", badge: "sanciones" },
];

export const NAV_ADMIN: ItemNav[] = [
  { href: "/admin", etiqueta: "Inicio" },
  { href: "/admin/catalogo", etiqueta: "Catálogo" },
  { href: "/admin/stock", etiqueta: "Stock por sede", corta: "Stock" },
  { href: "/admin/prestamos", etiqueta: "Préstamos" },
  { href: "/admin/devolucion", etiqueta: "Devoluciones", corta: "Devolver" },
  { href: "/admin/sanciones", etiqueta: "Sanciones", badge: "vencidos" },
];

export function navDe(rol: Rol): ItemNav[] {
  return rol === "bibliotecario" ? NAV_ADMIN : NAV_ESTUDIANTE;
}

/** Subtítulo bajo la marca en el sidebar. */
export function subtituloMarca(rol: Rol): string {
  return rol === "bibliotecario" ? "Biblioteca · Administración" : "Biblioteca";
}

/**
 * Marca el item activo. El Inicio coincide exacto para que no quede
 * iluminado en todas las rutas hijas; el resto, por prefijo.
 */
export function esActivo(href: string, pathname: string): boolean {
  if (href === "/admin" || href === "/inicio") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
