import { randomUUID } from "node:crypto";
import amqplib from "amqplib";

const [tipo, ...args] = process.argv.slice(2);
const url = process.env.RABBITMQ_URL || "amqp://guest:guest@127.0.0.1:5672";
const hoy = () => new Date().toLocaleDateString("sv"); // YYYY-MM-DD local

let clave: string;
let cuerpo: string;
if (tipo === "rate") {
  clave = "backoffice.rate.changed.v1";
  cuerpo = JSON.stringify({ rateType: "LIBRARY_LATE_FEE", amount: args[0] ?? "3000", currency: "ARS", effectiveFrom: args[1] ?? hoy() });
} else if (tipo === "location") {
  clave = "backoffice.location.upserted.v1";
  cuerpo = JSON.stringify({ locationId: `loc-${randomUUID().slice(0, 8)}`, siteId: args[0] ?? "sede-monserrat", name: args[1] ?? "Biblioteca - PB", capacity: Number(args[2] ?? 100), status: "ACTIVE" });
} else if (tipo === "invalid") {
  clave = "backoffice.rate.changed.v1";
  cuerpo = "{esto no es json";
} else {
  console.error("Uso: publish:rate -- <monto> [YYYY-MM-DD] | publish:location -- <sede-id> <nombre> <capacidad> | publish:invalid");
  process.exit(1);
}

try {
  const con = await amqplib.connect(url);
  const ch = await con.createConfirmChannel();
  await ch.assertExchange("backoffice.events", "topic", { durable: true });
  ch.publish("backoffice.events", clave, Buffer.from(cuerpo), { persistent: true, contentType: "application/json", messageId: randomUUID() });
  await ch.waitForConfirms();
  console.log(`[backoffice] publicado ${clave}: ${cuerpo}`);
  await con.close();
} catch (e) {
  console.error(`[backoffice] No se pudo publicar: RabbitMQ no responde en ${url} (${(e as Error).message}). Levantalo con "docker compose up -d".`);
  process.exit(1);
}
