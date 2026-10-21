import { test } from "node:test";
import assert from "node:assert/strict";
import { diasAtraso, diasRestantes } from "../dominio/reglas.js";
import type { FechaISO } from "../dominio/tipos.js";
import type { Repositorio } from "./repositorio.js";

/** Tests de contrato: los corre cada implementacion de Repositorio (memoria, MariaDB). */
export function contratoRepositorio(nombre: string, crear: (hoy: FechaISO) => Promise<Repositorio>): void {
  test(`${nombre}: seed desplazado: PRE-1003 vence en 2 días y PRE-1001 lleva 18 de atraso`, async () => {
    const hoy = "2026-11-02";
    const repo = await crear(hoy);
    assert.equal(diasRestantes((await repo.prestamo("PRE-1003"))!, hoy), 2);
    assert.equal(diasAtraso((await repo.prestamo("PRE-1001"))!, hoy), 18);
  });
  test(`${nombre}: siguienteId continúa la secuencia del seed`, async () => {
    const repo = await crear("2026-08-26");
    assert.equal(await repo.siguienteId("prestamo"), "PRE-1009");
    assert.equal(await repo.siguienteId("sancion"), "SAN-00032");
  });
  test(`${nombre}: transaccion descarta todo si el trabajo lanza`, async () => {
    const repo = await crear("2026-08-26");
    const antes = (await repo.prestamos()).length;
    await assert.rejects(repo.transaccion(async (r) => { await r.guardarPrestamo({ ...(await r.prestamo("PRE-1003"))!, id: "PRE-X" }); throw new Error("x"); }));
    assert.equal((await repo.prestamos()).length, antes);
  });
  test(`${nombre}: transacciones concurrentes se serializan`, async () => {
    const repo = await crear("2026-08-26");
    const orden: string[] = [];
    await Promise.all([
      repo.transaccion(async () => { orden.push("a1"); await new Promise((r) => setTimeout(r, 20)); orden.push("a2"); }),
      repo.transaccion(async () => { orden.push("b1"); orden.push("b2"); }),
    ]);
    assert.deepEqual(orden, ["a1", "a2", "b1", "b2"]);
  });
  test(`${nombre}: tarifa inicial 2500 vigente desde la fecha de arranque`, async () => {
    assert.deepEqual(await (await crear("2026-08-26")).tarifas(), [{ monto: 2500, vigenteDesde: "2026-08-26" }]);
  });
  test(`${nombre}: las lecturas devuelven copias y guardar hace upsert`, async () => {
    const repo = await crear("2026-08-26");
    (await repo.libros())[0].titulo = "mutado";
    assert.notEqual((await repo.libros())[0].titulo, "mutado");
    const l = (await repo.libro("9780132350884"))!;
    await repo.guardarLibro({ ...l, activo: false });
    assert.equal((await repo.libros()).length, 12);
    assert.equal((await repo.libro(l.isbn))!.activo, false);
  });
}
