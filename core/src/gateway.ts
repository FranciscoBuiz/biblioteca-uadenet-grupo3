import { randomUUID } from "node:crypto";
import express, { type RequestHandler } from "express";
import { permisosDe, rolesDe } from "./auth.js";
import type { Lector } from "./usuarios.js";

export interface OpcionesGateway { libraryUrl: string; gatewayKey: string; log: (l: string) => void }

const NO_DISPONIBLE = {
  code: "LIBRARY_UNAVAILABLE",
  message: "La biblioteca no está disponible en este momento. Intentá de nuevo en unos minutos.",
};

/** Reenvia a la Biblioteca. Los headers se arman desde cero: los X-User-*, X-Gateway-Key y X-Service-Key del cliente nunca pasan. */
export const gateway = (o: OpcionesGateway): RequestHandler[] => [
  express.raw({ type: "*/*", limit: "1mb" }),
  async (req, res) => {
    const lector = res.locals.lector as Lector;
    const correlationId = req.header("x-correlation-id") || randomUUID();
    const headers: Record<string, string> = {
      "x-user-id": lector.id,
      "x-user-roles": rolesDe(lector).join(","),
      "x-user-permissions": permisosDe(lector).join(","),
      "x-gateway-key": o.gatewayKey,
      "x-correlation-id": correlationId,
    };
    const tipo = req.header("content-type");
    if (tipo) headers["content-type"] = tipo;
    const ruta = req.originalUrl.split("?")[0];
    const base = new URL(o.libraryUrl);
    const destino = new URL(req.originalUrl, base);
    // fetch normaliza los ".."; se rechaza el camino crudo antes para que no llegue a otra ruta con la clave del Gateway.
    if (/(^|\/)\.\.?(\/|$)|%2e|%2f|%5c/i.test(ruta) || destino.origin !== base.origin
      || !(destino.pathname === "/api/v1/library" || destino.pathname.startsWith("/api/v1/library/"))) {
      res.status(400).json({ code: "INVALID_PATH", message: "Ruta inválida." });
      return;
    }
    const conCuerpo = !["GET", "HEAD"].includes(req.method) && Buffer.isBuffer(req.body) && req.body.length > 0;
    try {
      const r = await fetch(destino, {
        method: req.method, headers, body: conCuerpo ? new Uint8Array(req.body) : undefined,
        signal: AbortSignal.timeout(10000),
      });
      o.log(`[core] ${correlationId} → library ${req.method} ${ruta} ${r.status}`);
      res.status(r.status).set("x-correlation-id", correlationId);
      const ct = r.headers.get("content-type");
      if (ct) res.set("content-type", ct);
      res.send(Buffer.from(await r.arrayBuffer()));
    } catch {
      o.log(`[core] ${correlationId} → library ${req.method} ${ruta} UNAVAILABLE`);
      res.status(502).json(NO_DISPONIBLE);
    }
  },
];
