import { randomUUID } from "node:crypto";
import type { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { CoreNoDisponible } from "../integracion/core.js";
import type { Rol } from "../dominio/tipos.js";
import { ErrorNegocio } from "../servicios/errores.js";

export interface Usuario { id: string; rol: Rol }

const PROHIBIDO = { code: "FORBIDDEN", message: "No tenés permisos para realizar esta acción." };

export const correlacion = (log: (l: string) => void): RequestHandler => (req, res, next) => {
  const id = req.header("x-correlation-id") || randomUUID();
  res.locals.correlationId = id;
  const t0 = Date.now();
  res.on("finish", () => log(`[library] ${id} ${req.method} ${req.originalUrl.split("?")[0]} ${res.statusCode} ${Date.now() - t0}ms`));
  next();
};

export const claveGateway = (clave: string): RequestHandler => (req, res, next) => {
  if (req.header("x-gateway-key") !== clave) {
    res.status(401).json({ code: "GATEWAY_REQUIRED", message: "Las solicitudes deben pasar por el Gateway." });
    return;
  }
  next();
};

/** Roles del Gateway ("student", "librarian" o lista separada por comas) -> rol interno. */
export const identidad: RequestHandler = (req, res, next) => {
  const id = req.header("x-user-id");
  if (!id) {
    res.status(401).json({ code: "UNAUTHENTICATED", message: "Iniciá sesión para continuar." });
    return;
  }
  const roles = (req.header("x-user-roles") ?? "").split(",").map((r) => r.trim());
  const rol: Rol | null = roles.includes("librarian") ? "bibliotecario" : roles.includes("student") ? "estudiante" : null;
  if (!rol) {
    res.status(403).json(PROHIBIDO);
    return;
  }
  res.locals.usuario = { id, rol } satisfies Usuario;
  next();
};

export const permitir = (...roles: Rol[]): RequestHandler => (_req, res, next) => {
  if (!roles.includes((res.locals.usuario as Usuario).rol)) {
    res.status(403).json(PROHIBIDO);
    return;
  }
  next();
};

export const manejarErrores = (log: (l: string) => void): ErrorRequestHandler => (err, _req, res, _next) => {
  if (err instanceof ErrorNegocio) {
    res.status(err.status).json({ code: err.code, message: err.message });
  } else if (err instanceof CoreNoDisponible) {
    res.status(503).json({ code: "CORE_UNAVAILABLE", message: "No pudimos obtener los datos de UADEnet en este momento. Intentá de nuevo en unos minutos." });
  } else if (err instanceof ZodError) {
    res.status(400).json({ code: "VALIDATION_ERROR", message: err.issues[0]?.message ?? "Datos inválidos." });
  } else if (err?.type === "entity.parse.failed") {
    res.status(400).json({ code: "VALIDATION_ERROR", message: "El cuerpo de la solicitud no es un JSON válido." });
  } else {
    log(`[library] ${res.locals.correlationId} ERROR ${err?.stack ?? err}`);
    res.status(500).json({ code: "INTERNAL_ERROR", message: "Ocurrió un error inesperado. Intentá de nuevo." });
  }
};
