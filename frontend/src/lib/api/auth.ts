import { demora, getDb, mutar } from "@/lib/store/db";
import type { User } from "@/lib/domain/types";
import { ApiError } from "./errors";

/* ---------------------------------------------------------------
   POST /api/v1/auth/login
   Body: { email, password }  (ver UADEnet_Biblioteca_Grupo3.xlsx)
   --------------------------------------------------------------- */

/** Credenciales que se muestran en la pantalla de login de la demo. */
export const CUENTAS_DEMO = [
  {
    email: "ana.garcia@uade.edu.ar",
    password: "uade1234",
    descripcion: "Estudiante — 4 préstamos y 1 sanción pendiente",
  },
  {
    email: "laura.fernandez@uade.edu.ar",
    password: "uade1234",
    descripcion: "Bibliotecaria — panel de administración",
  },
] as const;

/** Contraseña única de la demo. Sin backend no hay nada que verificar de verdad. */
const PASSWORD_DEMO = "uade1234";

export async function login(email: string, password: string): Promise<User> {
  await demora();

  const normalizado = email.trim().toLowerCase();

  if (!normalizado) throw new ApiError("Ingresá tu mail institucional.");
  if (!normalizado.endsWith("@uade.edu.ar")) {
    throw new ApiError("Usá tu mail institucional @uade.edu.ar.");
  }
  if (!password) throw new ApiError("Ingresá tu contraseña.");

  const usuario = getDb().usuarios.find(
    (u) => u.email.toLowerCase() === normalizado,
  );

  if (!usuario || password !== PASSWORD_DEMO) {
    throw new ApiError("El mail o la contraseña no son correctos.", 401);
  }

  mutar(() => ({ sesion: usuario.id }));
  return usuario;
}

export async function logout(): Promise<void> {
  mutar(() => ({ sesion: null }));
}

/** Usuario de la sesión actual, o null si nadie inició sesión. */
export function usuarioActual(): User | null {
  const db = getDb();
  if (!db.sesion) return null;
  return db.usuarios.find((u) => u.id === db.sesion) ?? null;
}
