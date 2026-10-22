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

  test(`${nombre}: transaccion exitosa persiste y devuelve el valor del trabajo`, async () => {
    const repo = await crear("2026-08-26");
    const r = await repo.transaccion(async (t) => {
      await t.guardarPrestamo({ ...(await t.prestamo("PRE-1003"))!, id: "PRE-OK" });
      return 42;
    });
    assert.equal(r, 42);
    assert.equal((await repo.prestamo("PRE-OK"))!.id, "PRE-OK");
  });
  test(`${nombre}: siguienteId avanza en llamadas consecutivas`, async () => {
    const repo = await crear("2026-08-26");
    assert.equal(await repo.siguienteId("prestamo"), "PRE-1009");
    assert.equal(await repo.siguienteId("prestamo"), "PRE-1010");
    assert.equal(await repo.siguienteId("sancion"), "SAN-00032");
    assert.equal(await repo.siguienteId("sancion"), "SAN-00033");
  });
  test(`${nombre}: agregarTarifa agrega y el mismo dia pisa la anterior`, async () => {
    const repo = await crear("2026-08-26");
    await repo.agregarTarifa({ monto: 3000, vigenteDesde: "2026-09-01" });
    await repo.agregarTarifa({ monto: 3500, vigenteDesde: "2026-09-01" });
    const t = (await repo.tarifas()).sort((a, b) => a.vigenteDesde.localeCompare(b.vigenteDesde));
    assert.deepEqual(t, [
      { monto: 2500, vigenteDesde: "2026-08-26" },
      { monto: 3500, vigenteDesde: "2026-09-01" },
    ]);
  });
  test(`${nombre}: sanciones: guardar, leer, sancion y sancionDe`, async () => {
    const repo = await crear("2026-08-26");
    const base = (await repo.sancion("SAN-00031"))!;
    assert.equal((await repo.sancionDe("PRE-1001"))!.id, "SAN-00031");
    assert.equal(await repo.sancionDe("PRE-1003"), undefined);
    assert.equal(await repo.sancion("SAN-NO"), undefined);
    const n = (await repo.sanciones()).length;
    await repo.guardarSancion({ ...base, estado: "cobrada", fechaCobro: "2026-08-26" });
    assert.equal((await repo.sanciones()).length, n);
    assert.equal((await repo.sancion("SAN-00031"))!.estado, "cobrada");
    await repo.guardarSancion({ ...base, id: "SAN-00032", loanId: "PRE-1003" });
    assert.equal((await repo.sanciones()).length, n + 1);
    assert.equal((await repo.sancionDe("PRE-1003"))!.id, "SAN-00032");
  });
  test(`${nombre}: notificaciones filtra por usuario y guardar hace upsert`, async () => {
    const repo = await crear("2026-08-26");
    const ana = await repo.notificaciones("u-ana");
    assert.ok(ana.length > 1 && ana.every((x) => x.userId === "u-ana"));
    assert.deepEqual((await repo.notificaciones("u-martin")).map((x) => x.id), ["NOT-010"]);
    assert.deepEqual(await repo.notificaciones("u-nadie"), []);
    const nueva = { ...ana[0], id: "NOT-NUEVA", userId: "u-martin" };
    await repo.guardarNotificaciones([nueva, { ...ana[0], leida: !ana[0].leida }]);
    assert.deepEqual((await repo.notificaciones("u-martin")).map((x) => x.id).sort(), ["NOT-010", "NOT-NUEVA"]);
    const n = (await repo.notificaciones("u-ana")).find((x) => x.id === ana[0].id)!;
    assert.equal(n.leida, !ana[0].leida);
    assert.equal((await repo.notificaciones("u-ana")).length, ana.length);
  });
  test(`${nombre}: actividad se registra y se lee`, async () => {
    const repo = await crear("2026-08-26");
    const n = (await repo.actividad()).length;
    const a = { id: "ACT-NUEVA", tipo: "prestamo" as const, texto: "x", fecha: "2026-08-26", hora: "10:00" };
    await repo.registrarActividad(a);
    const todas = await repo.actividad();
    assert.equal(todas.length, n + 1);
    assert.deepEqual(todas.find((x) => x.id === "ACT-NUEVA"), a);
  });
  test(`${nombre}: ubicaciones: guardar agrega y hace upsert por locationId`, async () => {
    const repo = await crear("2026-08-26");
    const antes = await repo.ubicaciones();
    assert.ok(antes.length > 0);
    await repo.guardarUbicacion({ ...antes[0], capacity: 999 });
    await repo.guardarUbicacion({ locationId: "LOC-X", siteId: "belgrano", name: "Nueva", capacity: 5, status: "active" });
    const despues = await repo.ubicaciones();
    assert.equal(despues.length, antes.length + 1);
    assert.equal(despues.find((u) => u.locationId === antes[0].locationId)!.capacity, 999);
    assert.equal(despues.find((u) => u.locationId === "LOC-X")!.name, "Nueva");
  });
  test(`${nombre}: ejemplares filtra por isbn y guardarEjemplares hace upsert`, async () => {
    const repo = await crear("2026-08-26");
    const todos = await repo.ejemplares();
    const cc = await repo.ejemplares("9780132350884");
    assert.deepEqual(cc.map((c) => c.codigo).sort(), ["BA-001", "BA-002", "BA-003", "BA-028"]);
    assert.deepEqual(await repo.ejemplares("0000000000"), []);
    const ba1 = cc.find((c) => c.codigo === "BA-001")!;
    await repo.guardarEjemplares([{ ...ba1, estado: "baja" }, { codigo: "BA-900", isbn: "9780132350884", sede: "belgrano", estado: "disponible" }]);
    assert.equal((await repo.ejemplares()).length, todos.length + 1);
    const nuevos = await repo.ejemplares("9780132350884");
    assert.equal(nuevos.length, 5);
    assert.equal(nuevos.find((c) => c.codigo === "BA-001")!.estado, "baja");
  });
}
