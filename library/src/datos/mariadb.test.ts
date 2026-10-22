import { after, test } from "node:test";
import assert from "node:assert/strict";
import * as mariadb from "mariadb";
import { contratoRepositorio } from "./contrato.js";
import { borrarEsquema, crearRepositorioMariaDB } from "./mariadb.js";

const url = process.env.MARIADB_TEST_URL;

if (!url) {
  test.skip("mariadb: MARIADB_TEST_URL no definida");
} else {
  const pool = mariadb.createPool(url);
  after(() => pool.end());
  const crear = async (hoy: string) => {
    await borrarEsquema(pool);
    return crearRepositorioMariaDB(pool, hoy);
  };

  contratoRepositorio("mariadb", crear);

  test("FK única: una segunda sanción para el mismo préstamo falla y no queda nada escrito", async () => {
    const repo = await crear("2026-08-26");
    const base = (await repo.sancion("SAN-00031"))!;
    const n = (await repo.sanciones()).length;
    await assert.rejects(
      repo.transaccion(async (r) => {
        await r.guardarPrestamo({ ...(await r.prestamo("PRE-1003"))!, renovaciones: 2 });
        await r.guardarSancion({ ...base, id: "SAN-09999" });
      }),
    );
    assert.equal((await repo.sanciones()).length, n);
    assert.notEqual((await repo.prestamo("PRE-1003"))!.renovaciones, 2);
  });

  test("los datos sobreviven a crear un segundo repositorio sobre el mismo pool (persistencia real)", async () => {
    const repo = await crear("2026-08-26");
    const id = await repo.siguienteId("prestamo");
    await repo.guardarPrestamo({ ...(await repo.prestamo("PRE-1003"))!, id });
    const otro = await crearRepositorioMariaDB(pool, "2026-08-26");
    assert.equal((await otro.prestamo(id))!.id, id);
    assert.equal(await otro.siguienteId("prestamo"), "PRE-1010");
  });
}
