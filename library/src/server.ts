import { randomUUID } from "node:crypto";
import * as mariadb from "mariadb";
import { crearRepositorioMariaDB } from "./datos/mariadb.js";
import { hoyReal } from "./dominio/reglas.js";
import { crearApp } from "./http/app.js";
import { iniciarConsumidor } from "./integracion/backoffice.js";
import { CoreHttp } from "./integracion/core.js";
import { detectarAtrasos } from "./servicios/deteccion.js";

const env = (k: string, d = "") => process.env[k] || d;
const serviceKey = env("SERVICE_KEY");
const gatewayKey = env("GATEWAY_KEY");
const databaseUrl = env("DATABASE_URL");
if (!serviceKey || !gatewayKey || !databaseUrl) {
  console.error("[library] Faltan SERVICE_KEY, GATEWAY_KEY o DATABASE_URL. Copiá library/.env.example a library/.env.");
  process.exit(1);
}
const puerto = Number(env("PORT", "4001"));

// URL.canParse evita que una DATABASE_URL mal escrita tire una excepcion en vez del mensaje.
const host = URL.canParse(databaseUrl) ? new URL(databaseUrl).host : "(DATABASE_URL inválida)";
const repo = await (async () => crearRepositorioMariaDB(mariadb.createPool(databaseUrl), hoyReal()))().catch((e: Error) => {
  console.error(`[library] No se pudo conectar a MariaDB en ${host}. ¿Levantaste \`docker compose up -d\`?`);
  console.error(`[library] ${e.message}`);
  process.exit(1);
});
const core = new CoreHttp(env("CORE_URL", "http://127.0.0.1:4000"), serviceKey);
const app = crearApp({ repo, core, gatewayKey });

async function jobAtrasos(): Promise<void> {
  const correlationId = `job-${randomUUID()}`;
  try {
    const n = (await detectarAtrasos({ repo, core, hoy: hoyReal(), correlationId })).length;
    console.log(`[library] ${correlationId} job atrasos: ${n} sanciones nuevas`);
  } catch (e) {
    console.error(`[library] ${correlationId} job atrasos fallo: ${(e as Error).message}`);
  }
}

app.listen(puerto, "127.0.0.1", () => {
  console.log(`[library] escuchando en 127.0.0.1:${puerto}`);
  void jobAtrasos();
  iniciarConsumidor(env("RABBITMQ_URL", "amqp://guest:guest@127.0.0.1:5672"), repo);
  setInterval(() => void jobAtrasos(), 60 * 60 * 1000);
});
