import { test } from "node:test";
import assert from "node:assert/strict";
import { FECHA_MAQUETA, sembrar } from "./seed.js";

test("sembrar con la fecha de la maqueta no corre nada", () => {
  const d = sembrar(FECHA_MAQUETA);
  assert.equal(d.prestamos.find((p) => p.id === "PRE-1003")!.fechaLimite, "2026-08-28");
  assert.equal(d.ubicaciones.length, 3);
});

test("sembrar corre también las fechas dentro de los textos", () => {
  const n = sembrar("2026-11-02").notificaciones.find((x) => x.id === "NOT-005")!;
  assert.match(n.cuerpo, /venció el 30\/10\/2026/);
});
