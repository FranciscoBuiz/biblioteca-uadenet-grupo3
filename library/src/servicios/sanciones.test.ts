import assert from "node:assert/strict";
import { test } from "node:test";
import { crearRepositorioEnMemoria } from "../datos/memoria.js";
import { sumarDias } from "../dominio/reglas.js";
import { CoreFalso } from "../integracion/core.js";
import type { Contexto } from "./comun.js";
import { montoVigente, obtenerSancion, pagarSancion } from "./sanciones.js";

const HOY = "2026-08-26";
const rechazo = (code: string, status: number, mensaje?: string) => (e: unknown) =>
  (e as { code: string }).code === code &&
  (e as { status: number }).status === status &&
  (mensaje === undefined || (e as Error).message === mensaje);

function contexto(): Contexto & { core: CoreFalso } {
  return { repo: crearRepositorioEnMemoria(HOY), core: new CoreFalso(), hoy: HOY, correlationId: "test-corr" };
}

test("montoVigente ignora una tarifa con vigenteDesde futuro y la toma cuando llega", async () => {
  const repo = crearRepositorioEnMemoria(HOY);
  await repo.agregarTarifa({ monto: 3000, vigenteDesde: sumarDias(HOY, 3) });
  assert.equal(await montoVigente(repo, HOY), 2500);
  assert.equal(await montoVigente(repo, sumarDias(HOY, 3)), 3000);
});

test("pagar con saldo suficiente: cobrada, comprobante con monto y operacion, core.debitos contiene 'penalty/SAN-…'", async () => {
  const ctx = contexto();
  ctx.core.saldos.set("u-ana", 10000);
  const recibo = await pagarSancion(ctx, "SAN-00031", "u-ana");
  assert.deepEqual(recibo, { operacion: "OP-1", penaltyId: "SAN-00031", monto: 2500, metodo: "saldo", fecha: HOY });
  assert.deepEqual(ctx.core.debitos, ["penalty/SAN-00031"]);
  const s = await ctx.repo.sancion("SAN-00031");
  assert.equal(s?.estado, "cobrada");
  assert.equal(s?.fechaCobro, HOY);
  const notis = await ctx.repo.notificaciones("u-ana");
  assert.ok(notis.some((n) => n.cuerpo === "Registramos el pago de $2.500 por la multa SAN-00031. Ya podés volver a solicitar préstamos."));
});

test("pagar dos veces → la segunda 409 ALREADY_PAID 'Esta multa ya fue abonada.' y un solo débito", async () => {
  const ctx = contexto();
  ctx.core.saldos.set("u-ana", 10000);
  await pagarSancion(ctx, "SAN-00031", "u-ana");
  await assert.rejects(pagarSancion(ctx, "SAN-00031", "u-ana"), rechazo("ALREADY_PAID", 409, "Esta multa ya fue abonada."));
  assert.deepEqual(ctx.core.debitos, ["penalty/SAN-00031"]);
});

test("pagar dos veces a la vez → un solo débito, cobrada y ninguna respuesta 5xx", async () => {
  const ctx = contexto();
  ctx.core.saldos.set("u-ana", 10000);
  const resultados = await Promise.allSettled([
    pagarSancion(ctx, "SAN-00031", "u-ana"),
    pagarSancion(ctx, "SAN-00031", "u-ana"),
  ]);
  assert.deepEqual(ctx.core.debitos, ["penalty/SAN-00031"]);
  assert.equal(ctx.core.saldos.get("u-ana"), 7500);
  assert.equal((await ctx.repo.sancion("SAN-00031"))?.estado, "cobrada");
  for (const r of resultados) {
    if (r.status === "rejected") assert.ok(r.reason.status < 500, `respuesta ${r.reason.status}`);
  }
  assert.ok(resultados.some((r) => r.status === "fulfilled"));
});

test("pagar sin saldo → 409 INSUFFICIENT_FUNDS y la sanción sigue pendiente", async () => {
  const ctx = contexto();
  await assert.rejects(
    pagarSancion(ctx, "SAN-00031", "u-ana"),
    rechazo("INSUFFICIENT_FUNDS", 409, "No tenés saldo suficiente en tu cuenta UADEnet para pagar esta multa."),
  );
  assert.equal((await ctx.repo.sancion("SAN-00031"))?.estado, "pendiente");
});

test("pagar con CORE caído → 503 CORE_UNAVAILABLE y la sanción sigue pendiente", async () => {
  const ctx = contexto();
  ctx.core.saldos.set("u-ana", 10000);
  ctx.core.caido = true;
  await assert.rejects(
    pagarSancion(ctx, "SAN-00031", "u-ana"),
    rechazo("CORE_UNAVAILABLE", 503, "No pudimos procesar el pago en este momento. Intentá de nuevo en unos minutos."),
  );
  assert.equal((await ctx.repo.sancion("SAN-00031"))?.estado, "pendiente");
});

test("sanción ajena → 404 NOT_FOUND al verla y al pagarla, sin débito", async () => {
  const ctx = contexto();
  ctx.core.saldos.set("u-martin", 10000);
  await assert.rejects(obtenerSancion(ctx, "SAN-00031", "u-martin"), rechazo("NOT_FOUND", 404, "No encontramos esa sanción."));
  await assert.rejects(pagarSancion(ctx, "SAN-00031", "u-martin"), rechazo("NOT_FOUND", 404, "No encontramos esa sanción."));
  assert.deepEqual(ctx.core.debitos, []);
  assert.equal((await obtenerSancion(ctx, "SAN-00031", "u-ana")).estudiante.nombre, "Ana García");
});
