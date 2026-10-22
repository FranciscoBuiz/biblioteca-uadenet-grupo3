import type { User } from "@/lib/domain/types";
import { ApiError } from "./errors";

const CORE_URL = process.env.NEXT_PUBLIC_CORE_URL ?? "http://localhost:4000";
const RUTA_LOGIN = "/api/v1/auth/login";
const CLAVE_SESION = "uadenet-sesion";

/* --- Sesion (sessionStorage) ---------------------------------- */

export interface Sesion {
  token: string;
  usuario: User;
}

const oyentesSesion = new Set<() => void>();
// Cache por texto crudo: useSyncExternalStore pide la misma referencia mientras nada cambie.
let crudo: string | null = null;
let cache: Sesion | null = null;

export function leerSesion(): Sesion | null {
  if (typeof window === "undefined") return null;
  let actual: string | null = null;
  try {
    actual = window.sessionStorage.getItem(CLAVE_SESION);
  } catch {
    return null;
  }
  if (actual !== crudo) {
    crudo = actual;
    try {
      cache = actual ? (JSON.parse(actual) as Sesion) : null;
    } catch {
      cache = null;
    }
  }
  return cache;
}

export function guardarSesion(sesion: Sesion): void {
  try {
    window.sessionStorage.setItem(CLAVE_SESION, JSON.stringify(sesion));
  } catch {
    /* sin storage no hay sesion persistente: el usuario tendra que reingresar */
  }
  oyentesSesion.forEach((fn) => fn());
}

export function borrarSesion(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(CLAVE_SESION);
  } catch {
    /* idem */
  }
  oyentesSesion.forEach((fn) => fn());
}

export function suscribirSesion(fn: () => void): () => void {
  oyentesSesion.add(fn);
  return () => {
    oyentesSesion.delete(fn);
  };
}

/* --- Invalidacion --------------------------------------------- */

const oyentes = new Set<() => void>();

/** La llaman las mutaciones despues de un 2xx para que useApi vuelva a pedir. */
export function invalidar(): void {
  oyentes.forEach((fn) => fn());
}

export function suscribirInvalidacion(fn: () => void): () => void {
  oyentes.add(fn);
  return () => {
    oyentes.delete(fn);
  };
}

/* --- Cliente -------------------------------------------------- */

/** Arma "?a=1&b=2" salteando los valores vacios. */
export function consulta(params: Record<string, string | boolean | undefined>): string {
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "" && v !== false) usp.set(k, String(v));
  }
  const s = usp.toString();
  return s ? `?${s}` : "";
}

/**
 * Pide al CORE Gateway. `ruta` relativa va bajo /api/v1/library;
 * si empieza con /api/ se usa tal cual.
 */
export async function pedir<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
  const relativa = `/api/v1/library${ruta.startsWith("/") ? "" : "/"}${ruta}`;
  const url = CORE_URL + (ruta.startsWith("/api/") ? ruta : relativa);
  const headers: Record<string, string> = {};
  const token = leerSesion()?.token;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cuerpo !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(url, {
      method: metodo,
      headers,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ApiError("No pudimos conectarnos con UADEnet. Revisá tu conexión e intentá de nuevo.", 0);
  }

  const texto = await res.text();
  let datos: unknown;
  try {
    datos = texto ? JSON.parse(texto) : undefined;
  } catch {
    datos = undefined;
  }

  if (!res.ok) {
    const e = (datos ?? {}) as { code?: string; message?: string };
    if (res.status === 401 && e.code === "INVALID_TOKEN" && ruta !== RUTA_LOGIN) {
      borrarSesion();
      window.location.assign("/login");
    }
    throw new ApiError(e.message ?? "Ocurrió un error inesperado. Intentá de nuevo.", res.status, e.code);
  }

  if (metodo !== "GET") invalidar();
  return datos as T;
}
