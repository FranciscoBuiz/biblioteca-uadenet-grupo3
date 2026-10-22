import assert from "node:assert/strict";
import { test } from "node:test";
import { crearRepositorioEnMemoria } from "../datos/memoria.js";
import { sumarDias } from "../dominio/reglas.js";
import { CoreFalso, CoreNoDisponible } from "../integracion/core.js";
import type { Contexto } from "./comun.js";
import { detectarAtrasos } from "./deteccion.js";
import { devolverPrestamo, listarPrestamos, obtenerPrestamo, renovarPrestamo, solicitarPrestamo } from "./prestamos.js";

const HOY = "2026-08-26";
const DESIGN_PATTERNS = "9780201633610";
const rechazo = (code: string, status?: number) => (e: unknown) =>
  (e as { code: string }).code === code && (status === undefined || (e as { status: number }).status === status);

/** Contexto con el seed de HOY; `desfase` corre el "hoy" de los servicios. */
function contexto(desfase = 0): Contexto & { core: CoreFalso } {
  return { repo: crearRepositorioEnMemoria(HOY), core: new CoreFalso(), hoy: sumarDias(HOY, desfase), correlationId: "test-corr" };
}

test("solicitar con sanción pendiente → SANCTION_PENDING con el mensaje 'Tenés una sanción pendiente de pago…'", async () => {
  const ctx = contexto();
  await assert.rejects(solicitarPrestamo(ctx, DESIGN_PATTERNS, "monserrat", "u-ana"), (e: Error) => {
    assert.ok(rechazo("SANCTION_PENDING")(e));
    assert.equal(e.message, "Tenés una sanción pendiente de pago. Regularizá la multa para volver a solicitar préstamos.");
    return true;
  });
});

test("último ejemplar: dos solicitudes lanzadas a la vez con Promise.allSettled → una fulfilled, otra rejected NO_COPIES, y el ejemplar asignado a un solo préstamo", async () => {
  const ctx = contexto();
  const [a, b] = await Promise.allSettled([
    solicitarPrestamo(ctx, DESIGN_PATTERNS, "monserrat", "u-julian"),
    solicitarPrestamo(ctx, DESIGN_PATTERNS, "monserrat", "u-camila"),
  ]);
  const estados = [a.status, b.status].sort();
  assert.deepEqual(estados, ["fulfilled", "rejected"]);
  const fallo = [a, b].find((r) => r.status === "rejected") as PromiseRejectedResult;
  assert.ok(rechazo("NO_COPIES", 409)(fallo.reason));
  assert.equal(fallo.reason.message, "No hay ejemplares disponibles de Design Patterns en Monserrat.");
  const conBA005 = (await ctx.repo.prestamos()).filter((p) => p.copia === "BA-005");
  assert.equal(conBA005.length, 1);
  assert.equal((await ctx.repo.ejemplares(DESIGN_PATTERNS)).find((c) => c.codigo === "BA-005")?.estado, "prestado");
});

test("renovar suma 3 días; la tercera renovación falla con RENEWAL_LIMIT", async () => {
  const ctx = contexto();
  const r1 = await renovarPrestamo(ctx, "PRE-1003", "u-ana");
  assert.equal(r1.fechaLimite, "2026-08-31");
  const r2 = await renovarPrestamo(ctx, "PRE-1003", "u-ana");
  assert.equal(r2.fechaLimite, "2026-09-03");
  assert.equal(r2.renovaciones, 2);
  await assert.rejects(renovarPrestamo(ctx, "PRE-1003", "u-ana"), rechazo("RENEWAL_LIMIT", 409));
});

test("renovar préstamo ajeno → 404 NOT_FOUND", async () => {
  const ctx = contexto();
  await assert.rejects(renovarPrestamo(ctx, "PRE-1003", "u-martin"), (e: Error) => {
    assert.ok(rechazo("NOT_FOUND", 404)(e));
    assert.equal(e.message, "No encontramos ese préstamo.");
    return true;
  });
  await assert.rejects(obtenerPrestamo(ctx, "PRE-1003", "u-martin"), rechazo("NOT_FOUND", 404));
});

test("devolver con 9 días de atraso crea sanción de 2500, libera el ejemplar y publica 1 evento con subject 'user/<id>' y data.amount '2500.00'", async () => {
  const ctx = contexto(6); // PRE-1002 vencio el 23/08: al 01/09 son 9 dias
  const { prestamo, sancion } = await devolverPrestamo(ctx, "PRE-1002");
  assert.equal(prestamo.fechaDevolucion, ctx.hoy);
  assert.equal(sancion?.monto, 2500);
  assert.equal(sancion?.diasAtraso, 9);
  assert.equal(sancion?.estado, "pendiente");
  assert.equal((await ctx.repo.ejemplares("9780321125217")).find((c) => c.codigo === "BA-009")?.estado, "disponible");
  assert.equal(ctx.core.eventos.length, 1);
  assert.deepEqual(ctx.core.eventos[0], {
    eventType: "library.penalty.applied.v1",
    source: "library",
    subject: "user/u-ana",
    data: { userId: "u-ana", loanId: "PRE-1002", daysLate: 9, amount: "2500.00", currency: "ARS" },
  });
});

test("detectarAtrasos sanciona un préstamo abierto con 8 días y no duplica si corre dos veces (1 sanción, 1 evento)", async () => {
  const ctx = contexto(5);
  const nuevas = await detectarAtrasos(ctx);
  assert.deepEqual(nuevas.map((s) => [s.loanId, s.diasAtraso]), [["PRE-1002", 8]]);
  assert.deepEqual(await detectarAtrasos(ctx), []);
  assert.equal((await ctx.repo.sanciones()).filter((s) => s.loanId === "PRE-1002").length, 1);
  assert.equal(ctx.core.eventos.length, 1);
});

test("devolver un préstamo ya sancionado por la detección no crea otra sanción", async () => {
  const ctx = contexto(5);
  await detectarAtrasos(ctx);
  const { sancion } = await devolverPrestamo(ctx, "PRE-1002");
  assert.equal(sancion, null);
  assert.equal((await ctx.repo.sanciones()).filter((s) => s.loanId === "PRE-1002").length, 1);
  assert.equal(ctx.core.eventos.length, 1);
});

test("si publicarEvento lanza CoreNoDisponible, la sanción igual queda guardada", async (t) => {
  const ctx = contexto(6);
  t.mock.method(ctx.core, "publicarEvento", async () => {
    throw new CoreNoDisponible("CORE no disponible");
  });
  const log = t.mock.method(console, "error", () => undefined);
  const { sancion } = await devolverPrestamo(ctx, "PRE-1002");
  assert.ok(sancion);
  assert.equal((await ctx.repo.sancionDe("PRE-1002"))?.id, sancion.id);
  assert.equal(log.mock.callCount(), 1);
  assert.match(String(log.mock.calls[0].arguments[0]), /test-corr/);
});

test("listarPrestamos busca por DNI y legajo con un solo pedido de lectores al CORE", async (t) => {
  const ctx = contexto();
  const pedidos = t.mock.method(ctx.core, "lectores");
  const porDni = await listarPrestamos(ctx, { q: "42.118" });
  assert.deepEqual(porDni.map((p) => p.id), ["PRE-1006"]);
  assert.equal(porDni[0].estudiante.nombre, "Martín Souza");
  assert.equal(pedidos.mock.callCount(), 1);
  const porLegajo = await listarPrestamos(ctx, { q: "1103662" });
  assert.deepEqual(porLegajo.map((p) => p.id), ["PRE-1007"]);
});
