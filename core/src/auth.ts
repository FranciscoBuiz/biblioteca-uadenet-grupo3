import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { timingSafeEqual } from "node:crypto";
import { LECTORES, passwordValida, type Lector } from "./usuarios.js";

export const MSG = {
  mailVacio: "Ingresá tu mail institucional.",
  dominio: "Usá tu mail institucional @uade.edu.ar.",
  passVacia: "Ingresá tu contraseña.",
  credenciales: "El mail o la contraseña no son correctos.",
};

export const rolesDe = (l: Lector) => (l.rol === "bibliotecario" ? ["librarian"] : ["student"]);
export const permisosDe = (l: Lector) =>
  l.rol === "bibliotecario" ? ["library:read", "library:admin"] : ["library:read", "library:loan", "library:pay"];

export const firmar = (l: Lector, secreto: string) =>
  jwt.sign({ sub: l.id, roles: rolesDe(l), permissions: permisosDe(l) }, secreto, { algorithm: "HS256", expiresIn: "8h" });

/** Valida credenciales; devuelve el lector o lanza {status, code, message}. */
export function autenticar(email: unknown, password: unknown): Lector {
  const mail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const pass = typeof password === "string" ? password : "";
  if (!mail) throw { status: 400, code: "VALIDATION_ERROR", message: MSG.mailVacio };
  if (!mail.endsWith("@uade.edu.ar")) throw { status: 400, code: "VALIDATION_ERROR", message: MSG.dominio };
  if (!pass) throw { status: 400, code: "VALIDATION_ERROR", message: MSG.passVacia };
  const l = LECTORES.find((u) => u.email.toLowerCase() === mail);
  if (!l || !passwordValida(pass)) throw { status: 401, code: "INVALID_CREDENTIALS", message: MSG.credenciales };
  return l;
}

/** Bearer -> res.locals.lector. */
export const exigirToken = (secreto: string): RequestHandler => (req, res, next) => {
  const m = /^Bearer (.+)$/.exec(req.header("authorization") ?? "");
  try {
    if (!m) throw new Error("sin token");
    const p = jwt.verify(m[1], secreto, { algorithms: ["HS256"], maxAge: "8h" }) as jwt.JwtPayload;
    const l = LECTORES.find((u) => u.id === p.sub);
    if (!l) throw new Error("usuario desconocido");
    res.locals.lector = l;
    next();
  } catch {
    res.status(401).json({ code: "INVALID_TOKEN", message: "Tu sesión venció. Iniciá sesión de nuevo." });
  }
};

export const exigirServicio = (clave: string): RequestHandler => (req, res, next) => {
  const a = Buffer.from(req.header("x-service-key") ?? "");
  const b = Buffer.from(clave);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    res.status(401).json({ code: "UNAUTHORIZED", message: "Falta la clave de servicio." });
    return;
  }
  next();
};
