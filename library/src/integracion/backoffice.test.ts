import assert from "node:assert/strict";
import { test } from "node:test";
import { crearRepositorioEnMemoria } from "../datos/memoria.js";
import { montoVigente } from "../servicios/sanciones.js";
import { procesarMensaje } from "./backoffice.js";

const HOY = "2026-10-21";
const RATE = "backoffice.rate.changed.v1";
const LOC = "backoffice.location.upserted.v1";
const buf = (o: unknown) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o));
const rate = (o: object = {}) => ({ rateType: "LIBRARY_LATE_FEE", amount: "3000", currency: "ARS", effectiveFrom: HOY, ...o });
const loc = (o: object = {}) => ({ locationId: "L1", siteId: "sede-monserrat", name: "Biblioteca - PB", capacity: 120, status: "ACTIVE", ...o });

test("rate vigente hoy → aplicado y montoVigente 3000", async () => {
  const repo = crearRepositorioEnMemoria(HOY);
  assert.equal(await procesarMensaje(repo, RATE, buf(rate()), HOY), "aplicado");
  assert.equal(await montoVigente(repo, HOY), 3000);
});

test("rate con effectiveFrom futuro → aplicado, montoVigente sigue 2500", async () => {
  const repo = crearRepositorioEnMemoria(HOY);
  assert.equal(await procesarMensaje(repo, RATE, buf(rate({ effectiveFrom: "2027-01-01" })), HOY), "aplicado");
  assert.equal(await montoVigente(repo, HOY), 2500);
});

test("rate con rateType distinto → ignorado, tarifas sin cambios", async () => {
  const repo = crearRepositorioEnMemoria(HOY);
  const antes = await repo.tarifas();
  assert.equal(await procesarMensaje(repo, RATE, buf(rate({ rateType: "OTRA" })), HOY), "ignorado");
  assert.deepEqual(await repo.tarifas(), antes);
});

test("rate invalido: USD, amount abc/0/negativo, fecha mala, campos faltantes o JSON roto", async () => {
  const repo = crearRepositorioEnMemoria(HOY);
  const malos = [rate({ currency: "USD" }), rate({ amount: "abc" }), rate({ amount: "0" }), rate({ amount: "-5" }), rate({ amount: 3000 }),
    rate({ effectiveFrom: "21/10/2026" }), { rateType: "LIBRARY_LATE_FEE" }, "{roto"];
  for (const m of malos) assert.equal(await procesarMensaje(repo, RATE, buf(m), HOY), "invalido", JSON.stringify(m));
  assert.equal(await montoVigente(repo, HOY), 2500);
});

test("location sede-monserrat → aplicado, siteId monserrat", async () => {
  const repo = crearRepositorioEnMemoria(HOY);
  assert.equal(await procesarMensaje(repo, LOC, buf(loc()), HOY), "aplicado");
  assert.equal((await repo.ubicaciones()).find((u) => u.locationId === "L1")?.siteId, "monserrat");
});

test("location invalida: sede-rosario, capacity negativa/decimal, faltantes", async () => {
  const repo = crearRepositorioEnMemoria(HOY);
  const antes = (await repo.ubicaciones()).length;
  for (const m of [loc({ siteId: "sede-rosario" }), loc({ capacity: -1 }), loc({ capacity: 1.5 }), loc({ name: undefined })])
    assert.equal(await procesarMensaje(repo, LOC, buf(m), HOY), "invalido");
  assert.equal((await repo.ubicaciones()).length, antes);
});

test("routing key desconocida → invalido", async () => {
  assert.equal(await procesarMensaje(crearRepositorioEnMemoria(HOY), "backoffice.otra.v1", buf({}), HOY), "invalido");
});
