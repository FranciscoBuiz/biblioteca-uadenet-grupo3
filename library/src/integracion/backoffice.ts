import amqplib from "amqplib";
import { hoyReal } from "../dominio/reglas.js";
import type { FechaISO, Location, SedeId } from "../dominio/tipos.js";
import type { Repositorio } from "../datos/repositorio.js";

export type Resultado = "aplicado" | "ignorado" | "invalido";

const RATE_KEY = "backoffice.rate.changed.v1";
const LOCATION_KEY = "backoffice.location.upserted.v1";
const SEDES = ["monserrat", "belgrano", "pinamar"];
const REINTENTO_MS = 5000;

const esTexto = (v: unknown): v is string => typeof v === "string" && v.length > 0;

/** Valida y aplica un mensaje del Backoffice. Sin AMQP, para poder probarlo. */
export async function procesarMensaje(repo: Repositorio, routingKey: string, contenido: Buffer, hoy: FechaISO): Promise<Resultado> {
  let m: Record<string, unknown>;
  try {
    const j: unknown = JSON.parse(contenido.toString("utf8"));
    if (typeof j !== "object" || j === null || Array.isArray(j)) return "invalido";
    m = j as Record<string, unknown>;
  } catch {
    return "invalido";
  }
  if (routingKey === RATE_KEY) {
    if (!esTexto(m.rateType) || !esTexto(m.amount) || !esTexto(m.currency) || !esTexto(m.effectiveFrom)) return "invalido";
    if (m.rateType !== "LIBRARY_LATE_FEE") return "ignorado";
    const monto = Number(m.amount);
    if (!/^\d+(\.\d{1,2})?$/.test(m.amount) || !(monto > 0) || m.currency !== "ARS" || !/^\d{4}-\d{2}-\d{2}$/.test(m.effectiveFrom)) return "invalido";
    await repo.transaccion((r) => r.agregarTarifa({ monto, vigenteDesde: m.effectiveFrom as string }));
    return "aplicado";
  }
  if (routingKey === LOCATION_KEY) {
    const sede = esTexto(m.siteId) ? /^sede-(.+)$/.exec(m.siteId)?.[1] : undefined;
    if (!esTexto(m.locationId) || !sede || !SEDES.includes(sede) || typeof m.name !== "string" || typeof m.status !== "string") return "invalido";
    if (typeof m.capacity !== "number" || !Number.isInteger(m.capacity) || m.capacity < 0) return "invalido";
    const ubicacion: Location = { locationId: m.locationId, siteId: sede as SedeId, name: m.name, capacity: m.capacity, status: m.status };
    await repo.transaccion((r) => r.guardarUbicacion(ubicacion));
    return "aplicado";
  }
  return "invalido";
}

/**
 * Conecta, declara la topologia y consume. Nunca lanza: ante error o cierre
 * reintenta cada 5 s. Devuelve la funcion que lo detiene.
 */
export function iniciarConsumidor(url: string, repo: Repositorio): () => Promise<void> {
  let detenido = false;
  let timer: NodeJS.Timeout | undefined;
  let conexion: amqplib.ChannelModel | undefined;

  const reintentar = (motivo: string) => {
    if (detenido || timer) return;
    console.error(`[library] RabbitMQ no disponible (${motivo}); reintento en ${REINTENTO_MS / 1000} s`);
    conexion = undefined;
    timer = setTimeout(() => { timer = undefined; void conectar(); }, REINTENTO_MS);
  };

  async function conectar(): Promise<void> {
    try {
      const con = await amqplib.connect(url);
      if (detenido) { await con.close().catch(() => {}); return; }
      conexion = con;
      con.on("error", () => {}); // el "close" posterior dispara el reintento
      con.on("close", () => reintentar("conexion cerrada"));
      const ch = await con.createChannel();
      await ch.assertExchange("backoffice.events", "topic", { durable: true });
      await ch.assertExchange("library.dlx", "fanout", { durable: true });
      await ch.assertQueue("library.dlq", { durable: true });
      await ch.bindQueue("library.dlq", "library.dlx", "");
      await ch.assertQueue("library.backoffice", { durable: true, arguments: { "x-dead-letter-exchange": "library.dlx" } });
      await ch.bindQueue("library.backoffice", "backoffice.events", "backoffice.#");
      await ch.prefetch(10);
      await ch.consume("library.backoffice", async (msg) => {
        if (!msg) return;
        const clave = msg.fields.routingKey;
        let resultado: Resultado;
        try {
          resultado = await procesarMensaje(repo, clave, msg.content, hoyReal());
        } catch (e) {
          console.error(`[library] backoffice ${clave} error inesperado: ${(e as Error).message}`);
          resultado = "invalido";
        }
        console.log(`[library] backoffice ${clave} ${resultado}`);
        if (resultado === "invalido") ch.nack(msg, false, false);
        else ch.ack(msg);
      });
      console.log("[library] consumidor RabbitMQ listo (cola library.backoffice)");
    } catch (e) {
      await conexion?.close().catch(() => {});
      reintentar((e as Error).message);
    }
  }

  void conectar();
  return async () => {
    detenido = true;
    clearTimeout(timer);
    await conexion?.close().catch(() => {});
  };
}
