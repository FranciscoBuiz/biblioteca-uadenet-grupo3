import assert from "node:assert/strict";
import { test } from "node:test";
import { crearRepositorioEnMemoria } from "../datos/memoria.js";
import { CoreFalso, CoreNoDisponible } from "../integracion/core.js";
import { activarLibro, crearLibro, editarLibro, listarLibros, type AltaLibro } from "./catalogo.js";
import { listarNotificaciones, marcarLeida } from "./notificaciones.js";
import { actividadReciente } from "./panel.js";

const HOY = "2026-08-26";
const alta: AltaLibro = {
  isbn: "9781234567897", titulo: " Nuevo ", autor: "A", editorial: "E", anio: 2024,
  categoria: "Redes", descripcion: "d", sede: "belgrano", cantidad: 3,
};
const rechazo = (code: string, status: number) => (e: unknown) =>
  (e as { code: string }).code === code && (e as { status: number }).status === status;

test("crearLibro rechaza ISBN repetido con 409 BOOK_EXISTS", async () => {
  const repo = crearRepositorioEnMemoria(HOY);
  await crearLibro(repo, alta, HOY);
  await assert.rejects(crearLibro(repo, alta, HOY), rechazo("BOOK_EXISTS", 409));
});

test("crearLibro con ISBN de 9 dígitos → 400 INVALID_ISBN", async () => {
  const repo = crearRepositorioEnMemoria(HOY);
  await assert.rejects(crearLibro(repo, { ...alta, isbn: "123456789" }, HOY), rechazo("INVALID_ISBN", 400));
});

test("crearLibro genera N ejemplares disponibles en la sede y una actividad alta_ejemplar", async () => {
  const repo = crearRepositorioEnMemoria(HOY);
  await crearLibro(repo, alta, HOY);
  const copias = await repo.ejemplares(alta.isbn);
  assert.equal(copias.length, 3);
  assert.ok(copias.every((c) => c.estado === "disponible" && c.sede === "belgrano"));
  const act = (await actividadReciente(repo)).find((a) => a.tipo === "alta_ejemplar" && a.texto.includes("Nuevo"));
  assert.equal(act?.texto, "Alta de 3 ejemplares · Nuevo — Belgrano");
});

test("listarLibros con soloStock y sede filtra por porSede[sede] > 0", async () => {
  const repo = crearRepositorioEnMemoria(HOY);
  await crearLibro(repo, alta, HOY);
  const libros = await listarLibros(repo, { soloStock: true, sede: "belgrano" });
  assert.ok(libros.every((l) => l.porSede.belgrano > 0));
  assert.ok(libros.some((l) => l.isbn === alta.isbn));
});

test("marcarLeida de una notificación de otro usuario → 404 NOT_FOUND", async () => {
  const repo = crearRepositorioEnMemoria(HOY);
  const propia = (await repo.notificaciones("u-ana"))[0];
  assert.ok(propia, "el seed debe traer notificaciones de u-ana");
  await assert.rejects(marcarLeida(repo, "u-otro", propia.id), rechazo("NOT_FOUND", 404));
  assert.equal((await marcarLeida(repo, "u-ana", propia.id)).leida, true);
  assert.equal((await listarNotificaciones(repo, "u-ana", "sin_leer")).some((n) => n.id === propia.id), false);
});

test("crearLibro con cantidad 0 → 400 INVALID_QUANTITY", async () => {
  const repo = crearRepositorioEnMemoria(HOY);
  await assert.rejects(crearLibro(repo, { ...alta, cantidad: 0 }, HOY), rechazo("INVALID_QUANTITY", 400));
});

test("editarLibro ignora las claves isbn y activo", async () => {
  const repo = crearRepositorioEnMemoria(HOY);
  await crearLibro(repo, alta, HOY);
  const cambios = { titulo: " Otro ", isbn: "0000000000", activo: false } as never;
  const libro = await editarLibro(repo, alta.isbn, cambios);
  assert.equal(libro.titulo, "Otro");
  assert.equal(libro.isbn, alta.isbn);
  assert.equal(libro.activo, true);
  assert.equal((await repo.libro("0000000000")), undefined);
});

test("activarLibro(false) con ejemplares prestados → 409 COPIES_ON_LOAN", async () => {
  const repo = crearRepositorioEnMemoria(HOY);
  await assert.rejects(activarLibro(repo, "9780132350884", false), rechazo("COPIES_ON_LOAN", 409));
});

test("CoreFalso: debitar es idempotente y caido lanza CoreNoDisponible", async () => {
  const core = new CoreFalso();
  core.saldos.set("u-ana", 5000);
  const a = await core.debitar("u-ana", 2500, "SAN-1", "c");
  const b = await core.debitar("u-ana", 2500, "SAN-1", "c");
  assert.equal(a.operacion, b.operacion);
  assert.equal(core.saldos.get("u-ana"), 2500);
  assert.deepEqual(core.debitos, ["penalty/SAN-1"]);
  core.caido = true;
  await assert.rejects(core.lectores([], "c"), CoreNoDisponible);
});
