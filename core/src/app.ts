import express from "express";
import cors from "cors";
import { autenticar, exigirServicio, exigirToken, firmar } from "./auth.js";
import { debitar, formato, saldoDe } from "./billetera.js";
import { listar, publicar } from "./eventos.js";
import { gateway } from "./gateway.js";
import { LECTORES, lectorDto, type Lector } from "./usuarios.js";

export interface DepsCore {
  jwtSecret: string; gatewayKey: string; serviceKey: string;
  libraryUrl: string; frontendOrigin: string; log?: boolean;
}

export function crearApp(deps: DepsCore): express.Express {
  if (!deps.jwtSecret || !deps.gatewayKey || !deps.serviceKey) {
    throw new Error("Faltan JWT_SECRET, GATEWAY_KEY o SERVICE_KEY.");
  }
  const log = (l: string) => { if (deps.log) console.log(l); };
  const app = express();
  app.use(cors({
    origin: deps.frontendOrigin,
    allowedHeaders: ["Authorization", "Content-Type", "X-Correlation-Id"],
    exposedHeaders: ["X-Correlation-Id"],
  }));
  const token = exigirToken(deps.jwtSecret);

  app.post("/api/v1/auth/login", express.json(), (req, res) => {
    const lector = autenticar(req.body?.email, req.body?.password);
    res.json({ token: firmar(lector, deps.jwtSecret), user: lectorDto(lector) });
  });

  app.get("/api/v1/wallets/me", token, (_req, res) => {
    res.json({ balance: formato(saldoDe((res.locals.lector as Lector).id) ?? 0), currency: "ARS" });
  });

  app.all("/api/v1/library/*splat", token, ...gateway({ libraryUrl: deps.libraryUrl, gatewayKey: deps.gatewayKey, log }));

  const interno = express.Router();
  interno.use(exigirServicio(deps.serviceKey), express.json());
  interno.get("/users", (req, res) => {
    const ids = typeof req.query.ids === "string" ? req.query.ids.split(",") : null;
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() : "";
    const r = ids
      ? LECTORES.filter((l) => ids.includes(l.id))
      : LECTORES.filter((l) => [l.nombre, l.email, l.legajo, l.dni].some((c) => c.toLowerCase().includes(q)));
    res.json(r.map(lectorDto));
  });
  interno.post("/wallets/:userId/debits", (req, res) => {
    const { amount, currency, externalReference } = req.body ?? {};
    if (typeof amount !== "string" || !/^\d+(\.\d{1,2})?$/.test(amount) || !(Number(amount) > 0) || currency !== "ARS" || typeof externalReference !== "string" || !externalReference) {
      res.status(400).json({ code: "VALIDATION_ERROR", message: "Monto o referencia inválidos." });
      return;
    }
    const r = debitar(String(req.params.userId), amount, externalReference);
    if (r.estado === "sin_usuario") res.status(404).json({ code: "NOT_FOUND", message: "No encontramos al usuario." });
    else if (r.estado === "conflicto") res.status(409).json({ code: "IDEMPOTENCY_CONFLICT", message: "La referencia ya se usó con otros datos." });
    else if (r.estado === "sin_fondos") res.status(409).json({ code: "INSUFFICIENT_FUNDS", message: "Saldo insuficiente." });
    else res.status(r.estado === "ok" ? 201 : 200).json({ operationId: r.operationId, balance: r.balance });
  });
  interno.post("/events", (req, res) => {
    const { eventType, source, subject, data } = req.body ?? {};
    if (typeof eventType !== "string" || typeof source !== "string" || typeof subject !== "string") {
      res.status(400).json({ code: "VALIDATION_ERROR", message: "Evento inválido." });
      return;
    }
    publicar({ eventType, source, subject, data });
    res.status(202).json({ accepted: true });
  });
  interno.get("/events", (_req, res) => { res.json(listar()); });
  app.use("/internal/v1", interno);

  app.use(((err, _req, res, _next) => {
    if (err?.status && err?.code) res.status(err.status).json({ code: err.code, message: err.message });
    else if (err?.type === "entity.parse.failed" || (err?.status >= 400 && err?.status < 500)) res.status(err.status ?? 400).json({ code: "VALIDATION_ERROR", message: "El cuerpo de la solicitud no es un JSON válido." });
    else { log(`[core] ERROR ${err?.stack ?? err}`); res.status(500).json({ code: "INTERNAL_ERROR", message: "Ocurrió un error inesperado. Intentá de nuevo." }); }
  }) as express.ErrorRequestHandler);
  return app;
}
