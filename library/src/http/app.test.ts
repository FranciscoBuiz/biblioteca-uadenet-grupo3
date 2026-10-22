import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, describe, test } from "node:test";
import type { Server } from "node:http";
import { crearRepositorioEnMemoria } from "../datos/memoria.js";
import { CoreFalso } from "../integracion/core.js";
import { crearApp } from "./app.js";

const HOY = "2026-10-21";
const CLAVE = "clave-test";
let server: Server;
let base: string;
const core = new CoreFalso();

before(async () => {
  const app = crearApp({ repo: crearRepositorioEnMemoria(HOY), core, gatewayKey: CLAVE, hoy: () => HOY, log: () => {} });
  server = app.listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1/library`;
});
after(() => { server.close(); });

function pedir(ruta: string, quien: string | null, init: { method?: string; body?: unknown; raw?: string; clave?: string | null } = {}) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (init.clave !== null) headers["x-gateway-key"] = init.clave ?? CLAVE;
  if (quien && quien !== "bib") Object.assign(headers, { "x-user-id": quien, "x-user-roles": "student" });
  if (quien === "bib") Object.assign(headers, { "x-user-id": "u-laura", "x-user-roles": "student,librarian" });
  return fetch(base + ruta, {
    method: init.method ?? "GET", headers,
    body: init.raw ?? (init.body ? JSON.stringify(init.body) : undefined),
  }) as Promise<Omit<Response, "json"> & { json(): Promise<any> }>;
}

describe("API HTTP", () => {
  test("sin X-Gateway-Key → 401 GATEWAY_REQUIRED", async () => {
    const r = await pedir("/books", "u-ana", { clave: null });
    assert.equal(r.status, 401);
    assert.equal((await r.json()).code, "GATEWAY_REQUIRED");
  });

  test("clave del mismo largo pero distinta → 401", async () => {
    const r = await pedir("/loans", "u-ana", { clave: "clave-tesx" });
    assert.equal(r.status, 401);
  });

  test("crearApp sin gatewayKey falla al arrancar", () => {
    assert.throws(() => crearApp({ repo: crearRepositorioEnMemoria(HOY), core, gatewayKey: "", log: () => {} }), /GATEWAY_KEY/);
  });

  test("sin X-User-Id → 401", async () => {
    assert.equal((await pedir("/books", null)).status, 401);
  });

  test("estudiante en GET /indicators → 403 FORBIDDEN", async () => {
    const r = await pedir("/indicators", "u-ana");
    assert.equal(r.status, 403);
    assert.equal((await r.json()).code, "FORBIDDEN");
  });

  test("bibliotecario en GET /indicators → 200", async () => {
    const r = await pedir("/indicators", "bib");
    assert.equal(r.status, 200);
    assert.equal(typeof (await r.json()).available, "number");
  });

  test("GET /loans como u-ana devuelve solo los suyos con fechas numéricas", async () => {
    const r = await pedir("/loans?status=all", "u-ana");
    assert.equal(r.status, 200);
    const lista = await r.json();
    assert.ok(lista.length > 0);
    assert.ok(lista.every((l: { userId: string }) => l.userId === "u-ana"));
    assert.equal(typeof lista[0].dueAt, "number");
  });

  test("GET /loans/{id de otro} como estudiante → 404", async () => {
    const todos = await (await pedir("/loans?status=all", "bib")).json();
    const ajeno = todos.find((l: { userId: string }) => l.userId !== "u-ana");
    const r = await pedir(`/loans/${ajeno.id}`, "u-ana");
    assert.equal(r.status, 404);
    assert.equal((await r.json()).code, "NOT_FOUND");
  });

  test("GET /penalties/{id de otro} y POST …/payments ajeno → 404", async () => {
    const todas = await (await pedir("/penalties", "bib")).json();
    const ajena = todas.find((p: { userId: string }) => p.userId !== "u-ana");
    assert.equal((await pedir(`/penalties/${ajena.id}`, "u-ana")).status, 404);
    assert.equal((await pedir(`/penalties/${ajena.id}/payments`, "u-ana", { method: "POST" })).status, 404);
  });

  test("POST /books con body inválido → 400 VALIDATION_ERROR", async () => {
    const r = await pedir("/books", "bib", { method: "POST", body: { isbn: "9780132350884" } });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).code, "VALIDATION_ERROR");
  });

  test("JSON roto → 400 VALIDATION_ERROR", async () => {
    const r = await pedir("/books", "bib", { method: "POST", raw: "{no" });
    assert.equal(r.status, 400);
    assert.equal((await r.json()).code, "VALIDATION_ERROR");
  });

  test("PATCH de ejemplar a 'loaned' manual → 400", async () => {
    const r = await pedir("/books/9780132350884/copies/XX-1", "bib", { method: "PATCH", body: { status: "loaned" } });
    assert.equal(r.status, 400);
  });

  test("POST /books crea y devuelve 201", async () => {
    const r = await pedir("/books", "bib", {
      method: "POST",
      body: { isbn: "9781234567897", title: "Nuevo", author: "A", publisher: "E", year: 2020, category: "Redes", description: "d", siteId: "belgrano", quantity: 2 },
    });
    assert.equal(r.status, 201);
    assert.equal((await r.json()).title, "Nuevo");
  });

  test("POST /loans devuelve 201 con el préstamo creado", async () => {
    const libros = await (await pedir("/books?inStock=true&siteId=monserrat", "u-ana")).json();
    // u-ana puede tener sancion o tope; se prueba con un titulo en stock
    const r = await pedir("/loans", "u-camila", { method: "POST", body: { isbn: libros[0].isbn, siteId: "monserrat" } });
    assert.equal(r.status, 201);
    assert.equal(typeof (await r.json()).dueAt, "number");
  });

  test("GET /docs responde 200 text/html", async () => {
    const r = await fetch(base.replace("/api/v1/library", "/docs"));
    assert.equal(r.status, 200);
    assert.match(r.headers.get("content-type") ?? "", /text\/html/);
  });
});
