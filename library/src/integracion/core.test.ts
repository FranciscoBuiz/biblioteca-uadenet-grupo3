import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";
import express from "express";
import { CoreHttp, CoreNoDisponible, SaldoInsuficiente } from "./core.js";

const CLAVE = "svc-test";
const recibido: { ruta: string; headers: Record<string, unknown>; body: unknown }[] = [];
let modo = "ok";
let server: Server;
let core: CoreHttp;

before(async () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    recibido.push({ ruta: req.originalUrl, headers: req.headers, body: req.body });
    if (req.header("x-service-key") !== CLAVE) { res.status(401).json({ code: "UNAUTHORIZED" }); return; }
    next();
  });
  app.get("/internal/v1/users", (_req, res) => {
    res.json([{ id: "u-ana", name: "Ana Garcia", email: "ana@uade.edu.ar", studentId: "L1", nationalId: "1", role: "librarian", defaultSiteId: "belgrano", initials: "AG", label: "Bibliotecaria" }]);
  });
  app.post("/internal/v1/wallets/:id/debits", (_req, res) => {
    if (modo === "fondos") res.status(409).json({ code: "INSUFFICIENT_FUNDS" });
    else if (modo === "5xx") res.status(503).json({ code: "X" });
    else if (modo === "idem") res.status(409).json({ code: "IDEMPOTENCY_CONFLICT" });
    else res.status(201).json({ operationId: "OP-9", balance: "0.00" });
  });
  app.post("/internal/v1/events", (_req, res) => { res.status(202).json({ accepted: true }); });
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  core = new CoreHttp(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, CLAVE);
});
after(() => { server.close(); });

describe("CoreHttp", () => {
  test("debitar envía el body exacto de la planilla", async () => {
    const r = await core.debitar("u-ana", 2500, "SAN-00031", "corr-1");
    assert.deepEqual(r, { operacion: "OP-9" });
    const ult = recibido.at(-1)!;
    assert.equal(ult.ruta, "/internal/v1/wallets/u-ana/debits");
    assert.deepEqual(ult.body, { amount: "2500.00", currency: "ARS", concept: "LIBRARY_FINE", sourceModule: "library", externalReference: "penalty/SAN-00031" });
    assert.equal(ult.headers["x-correlation-id"], "corr-1");
    assert.equal(ult.headers["x-service-key"], CLAVE);
  });

  test("409 INSUFFICIENT_FUNDS → SaldoInsuficiente; 5xx → CoreNoDisponible", async () => {
    modo = "fondos";
    await assert.rejects(core.debitar("u-ana", 2500, "SAN-1", "c"), SaldoInsuficiente);
    modo = "5xx";
    await assert.rejects(core.debitar("u-ana", 2500, "SAN-1", "c"), CoreNoDisponible);
    modo = "ok";
  });

  test("servidor apagado → CoreNoDisponible", async () => {
    const caido = new CoreHttp("http://127.0.0.1:1", CLAVE);
    await assert.rejects(caido.lectores(["u-ana"], "c"), CoreNoDisponible);
  });

  test("otro estado inesperado → Error comun (bug, no caida)", async () => {
    modo = "idem";
    await assert.rejects(core.debitar("u-ana", 2500, "SAN-1", "c"), (e: Error) => !(e instanceof CoreNoDisponible) && !(e instanceof SaldoInsuficiente) && /409/.test(e.message) && /IDEMPOTENCY_CONFLICT/.test(e.message));
    modo = "ok";
    await assert.rejects(new CoreHttp(`http://127.0.0.1:${(server.address() as AddressInfo).port}`, "mala").lectores(["u"], "c"), /401/);
  });

  test("lectores y buscarLectores mapean el DTO a Lector", async () => {
    const [l] = await core.lectores(["u-ana"], "c");
    assert.deepEqual(l, { id: "u-ana", nombre: "Ana Garcia", email: "ana@uade.edu.ar", legajo: "L1", dni: "1", rol: "bibliotecario", sedeDefault: "belgrano", iniciales: "AG", etiqueta: "Bibliotecaria" });
    assert.equal(recibido.at(-1)!.ruta, "/internal/v1/users?ids=u-ana");
    await core.buscarLectores("ana g", "c");
    assert.equal(recibido.at(-1)!.ruta, "/internal/v1/users?q=ana+g");
  });

  test("publicarEvento envía eventType, source 'library', subject 'user/u-ana' y data.daysLate numérico", async () => {
    const evento = { eventType: "library.penalty.applied.v1", source: "library", subject: "user/u-ana", data: { userId: "u-ana", loanId: "PRE-1", daysLate: 9, amount: "2500.00", currency: "ARS" } } as const;
    await core.publicarEvento(evento, "c");
    const ult = recibido.at(-1)!;
    assert.equal(ult.ruta, "/internal/v1/events");
    assert.deepEqual(ult.body, evento);
    assert.equal(typeof (ult.body as typeof evento).data.daysLate, "number");
  });
});
