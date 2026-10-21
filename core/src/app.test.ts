import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import jwt from "jsonwebtoken";
import { crearApp } from "./app.js";

const JWT = "secreto-de-prueba", GW = "gw-key", SK = "svc-key", ORIGEN = "http://localhost:3000";
let core: Server, lib: Server, base: string;
let libUrl: string;

const escuchar = (app: express.Express) =>
  new Promise<Server>((ok) => { const s = app.listen(0, "127.0.0.1", () => ok(s)); });
const url = (s: Server) => `http://127.0.0.1:${(s.address() as AddressInfo).port}`;

before(async () => {
  // Biblioteca simulada: devuelve los headers recibidos.
  const falsa = express();
  falsa.use((req, res) => res.status(200).json({ method: req.method, url: req.originalUrl, headers: req.headers }));
  lib = await escuchar(falsa);
  libUrl = url(lib);
  core = await escuchar(crearApp({ jwtSecret: JWT, gatewayKey: GW, serviceKey: SK, libraryUrl: libUrl, frontendOrigin: ORIGEN }));
  base = url(core);
});
after(() => { core.close(); lib.close(); });

const login = async (email: string, password = "uade1234") => {
  const r = await fetch(`${base}/api/v1/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }),
  });
  return { status: r.status, body: (await r.json()) as any };
};
const tokenDe = async (email: string) => (await login(email)).body.token as string;
const interno = { "x-service-key": SK, "content-type": "application/json" };

test("crearApp falla cerrado si falta una clave", () => {
  assert.throws(() => crearApp({ jwtSecret: "", gatewayKey: GW, serviceKey: SK, libraryUrl: libUrl, frontendOrigin: ORIGEN }));
  assert.throws(() => crearApp({ jwtSecret: JWT, gatewayKey: "", serviceKey: SK, libraryUrl: libUrl, frontendOrigin: ORIGEN }));
  assert.throws(() => crearApp({ jwtSecret: JWT, gatewayKey: GW, serviceKey: "", libraryUrl: libUrl, frontendOrigin: ORIGEN }));
});

test("login con mail no @uade.edu.ar → 400 con 'Usá tu mail institucional @uade.edu.ar.'", async () => {
  const r = await login("ana@gmail.com");
  assert.equal(r.status, 400);
  assert.equal(r.body.message, "Usá tu mail institucional @uade.edu.ar.");
});

test("login: mail vacío, contraseña vacía y credenciales incorrectas", async () => {
  assert.equal((await login("")).body.message, "Ingresá tu mail institucional.");
  assert.equal((await login("ana.garcia@uade.edu.ar", "")).body.message, "Ingresá tu contraseña.");
  const r = await login("ana.garcia@uade.edu.ar", "mala");
  assert.equal(r.status, 401);
  assert.equal(r.body.message, "El mail o la contraseña no son correctos.");
});

test("login correcto devuelve token y user.role 'student' para ana", async () => {
  const r = await login("ana.garcia@uade.edu.ar");
  assert.equal(r.status, 200);
  assert.equal(r.body.user.role, "student");
  assert.equal(r.body.user.id, "u-ana");
  const p = jwt.verify(r.body.token, JWT) as jwt.JwtPayload;
  assert.deepEqual(p.roles, ["student"]);
  assert.deepEqual(p.permissions, ["library:read", "library:loan", "library:pay"]);
});

test("billetera de ana: 5000.00 ARS", async () => {
  const t = await tokenDe("ana.garcia@uade.edu.ar");
  const r = await fetch(`${base}/api/v1/wallets/me`, { headers: { authorization: `Bearer ${t}` } });
  assert.deepEqual(await r.json(), { balance: "5000.00", currency: "ARS" });
});

test("gateway sin token → 401 INVALID_TOKEN; con token vencido → 401", async () => {
  const sin = await fetch(`${base}/api/v1/library/books`);
  assert.equal(sin.status, 401);
  assert.equal(((await sin.json()) as any).code, "INVALID_TOKEN");
  const vencido = jwt.sign({ sub: "u-ana", roles: ["student"] }, JWT, { expiresIn: -10 });
  const r = await fetch(`${base}/api/v1/library/books`, { headers: { authorization: `Bearer ${vencido}` } });
  assert.equal(r.status, 401);
  assert.equal(((await r.json()) as any).code, "INVALID_TOKEN");
});

test("gateway reenvía X-User-*, X-Gateway-Key, propaga X-Correlation-Id y no reenvía Authorization", async () => {
  const t = await tokenDe("ana.garcia@uade.edu.ar");
  const r = await fetch(`${base}/api/v1/library/books?q=x`, { headers: { authorization: `Bearer ${t}`, "x-correlation-id": "corr-1" } });
  const b = (await r.json()) as any;
  assert.equal(b.url, "/api/v1/library/books?q=x");
  assert.equal(b.headers["x-user-id"], "u-ana");
  assert.equal(b.headers["x-user-roles"], "student");
  assert.equal(b.headers["x-user-permissions"], "library:read,library:loan,library:pay");
  assert.equal(b.headers["x-gateway-key"], GW);
  assert.equal(b.headers["x-correlation-id"], "corr-1");
  assert.equal(b.headers.authorization, undefined);
});

test("gateway reenvía método, body y Content-Type", async () => {
  const t = await tokenDe("ana.garcia@uade.edu.ar");
  const r = await fetch(`${base}/api/v1/library/loans`, {
    method: "POST", headers: { authorization: `Bearer ${t}`, "content-type": "application/json" }, body: JSON.stringify({ isbn: "1" }),
  });
  const b = (await r.json()) as any;
  assert.equal(b.method, "POST");
  assert.equal(b.headers["content-type"], "application/json");
});

test("gateway ignora X-User-Id enviado por el cliente: llega u-ana", async () => {
  const t = await tokenDe("ana.garcia@uade.edu.ar");
  const r = await fetch(`${base}/api/v1/library/books`, {
    headers: { authorization: `Bearer ${t}`, "x-user-id": "u-laura", "x-user-roles": "librarian", "x-gateway-key": "robada", "x-service-key": SK },
  });
  const b = (await r.json()) as any;
  assert.equal(b.headers["x-user-id"], "u-ana");
  assert.equal(b.headers["x-user-roles"], "student");
  assert.equal(b.headers["x-gateway-key"], GW);
  assert.equal(b.headers["x-service-key"], undefined);
});

test("gateway con biblioteca apagada → 502 LIBRARY_UNAVAILABLE", async () => {
  const muerta = await escuchar(express());
  const u = url(muerta);
  muerta.close();
  const app = await escuchar(crearApp({ jwtSecret: JWT, gatewayKey: GW, serviceKey: SK, libraryUrl: u, frontendOrigin: ORIGEN }));
  try {
    const t = await tokenDe("ana.garcia@uade.edu.ar");
    const r = await fetch(`${url(app)}/api/v1/library/books`, { headers: { authorization: `Bearer ${t}` } });
    assert.equal(r.status, 502);
    assert.equal(((await r.json()) as any).code, "LIBRARY_UNAVAILABLE");
  } finally { app.close(); }
});

test("CORS: preflight para library y login solo con el origen del frontend", async () => {
  for (const ruta of ["/api/v1/library/loans", "/api/v1/auth/login"]) {
    const r = await fetch(`${base}${ruta}`, {
      method: "OPTIONS",
      headers: { origin: ORIGEN, "access-control-request-method": "POST", "access-control-request-headers": "authorization,content-type,x-correlation-id" },
    });
    assert.equal(r.status, 204);
    assert.equal(r.headers.get("access-control-allow-origin"), ORIGEN);
  }
  const otro = await fetch(`${base}/api/v1/auth/login`, { method: "OPTIONS", headers: { origin: "http://malo.com", "access-control-request-method": "POST" } });
  assert.notEqual(otro.headers.get("access-control-allow-origin"), "http://malo.com");
});

const debito = (userId: string, ref: string, amount = "2500.00") =>
  fetch(`${base}/internal/v1/wallets/${userId}/debits`, {
    method: "POST", headers: interno,
    body: JSON.stringify({ amount, currency: "ARS", concept: "LIBRARY_FINE", sourceModule: "library", externalReference: ref }),
  });

test("débito idempotente por externalReference: dos POST, saldo baja una vez", async () => {
  const a = await debito("u-martin", "penalty/SAN-1");
  assert.equal(a.status, 201);
  const ba = (await a.json()) as any;
  assert.equal(ba.balance, "0.00");
  const b = await debito("u-martin", "penalty/SAN-1");
  assert.equal(b.status, 200);
  const bb = (await b.json()) as any;
  assert.equal(bb.operationId, ba.operationId);
  assert.equal(bb.balance, "0.00");
});

test("débito sin saldo → 409 INSUFFICIENT_FUNDS", async () => {
  const r = await debito("u-camila", "penalty/SAN-2");
  assert.equal(r.status, 409);
  assert.equal(((await r.json()) as any).code, "INSUFFICIENT_FUNDS");
});

test("/internal sin X-Service-Key (o con otra) → 401", async () => {
  assert.equal((await fetch(`${base}/internal/v1/events`)).status, 401);
  assert.equal((await fetch(`${base}/internal/v1/events`, { headers: { "x-service-key": "otra" } })).status, 401);
});

test("internal: usuarios por ids y por q, eventos", async () => {
  const u = (await (await fetch(`${base}/internal/v1/users?ids=u-ana,u-laura`, { headers: interno })).json()) as any[];
  assert.deepEqual(u.map((x) => x.id), ["u-ana", "u-laura"]);
  assert.equal(u[0].studentId, "1102345");
  const q = (await (await fetch(`${base}/internal/v1/users?q=souza`, { headers: interno })).json()) as any[];
  assert.deepEqual(q.map((x) => x.id), ["u-martin"]);
  const ev = { eventType: "library.penalty.applied.v1", source: "library", subject: "user/u-ana", data: { userId: "u-ana" } };
  const p = await fetch(`${base}/internal/v1/events`, { method: "POST", headers: interno, body: JSON.stringify(ev) });
  assert.equal(p.status, 202);
  const l = (await (await fetch(`${base}/internal/v1/events`, { headers: interno })).json()) as any[];
  assert.equal(l.length, 1);
  assert.equal(l[0].eventType, ev.eventType);
});
