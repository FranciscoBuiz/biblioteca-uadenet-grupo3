import { readFileSync } from "node:fs";
import express from "express";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";
import type { Repositorio } from "../datos/repositorio.js";
import type { FechaISO } from "../dominio/tipos.js";
import type { PuertoCore } from "../integracion/core.js";
import { claveGateway, correlacion, identidad, manejarErrores } from "./middlewares.js";
import { crearRutas } from "./rutas.js";

export interface DepsApp {
  repo: Repositorio;
  core: PuertoCore;
  gatewayKey: string;
  hoy?: () => FechaISO;
  /** Destino del log; por defecto la consola. */
  log?: (linea: string) => void;
}

export function crearApp(deps: DepsApp): express.Express {
  const log = deps.log ?? ((l: string) => console.log(l));
  const app = express();
  app.disable("x-powered-by");
  app.use(correlacion(log));
  // Fuera de gateway-key e identidad: el servidor escucha solo en 127.0.0.1.
  const doc = YAML.parse(readFileSync(new URL("../../openapi.yaml", import.meta.url), "utf8"));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(doc));
  app.use(claveGateway(deps.gatewayKey), identidad, express.json());
  app.use("/api/v1/library", crearRutas(deps));
  app.use((_req, res) => {
    res.status(404).json({ code: "NOT_FOUND", message: "Recurso no encontrado." });
  });
  app.use(manejarErrores(log));
  return app;
}
