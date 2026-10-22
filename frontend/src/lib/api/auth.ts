import type { User } from "@/lib/domain/types";
import { aUsuario, type LectorDto } from "./adaptadores";
import { ApiError } from "./errors";
import { borrarSesion, guardarSesion, leerSesion, pedir } from "./http";

/* ---------------------------------------------------------------
   POST /api/v1/auth/login
   Body: { email, password }  ->  { token, user }
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

export async function login(email: string, password: string): Promise<User> {
  const normalizado = email.trim().toLowerCase();

  if (!normalizado) throw new ApiError("Ingresá tu mail institucional.");
  if (!normalizado.endsWith("@uade.edu.ar")) {
    throw new ApiError("Usá tu mail institucional @uade.edu.ar.");
  }
  if (!password) throw new ApiError("Ingresá tu contraseña.");

  const { token, user } = await pedir<{ token: string; user: LectorDto }>(
    "POST",
    "/api/v1/auth/login",
    { email: normalizado, password },
  );
  const usuario = aUsuario(user);
  guardarSesion({ token, usuario });
  return usuario;
}

export async function logout(): Promise<void> {
  borrarSesion();
}

/** Usuario de la sesión actual, o null si nadie inició sesión. */
export function usuarioActual(): User | null {
  return leerSesion()?.usuario ?? null;
}
