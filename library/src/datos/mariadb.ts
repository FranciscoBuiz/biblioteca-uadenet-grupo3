import { readFileSync } from "node:fs";
import type * as mariadb from "mariadb";
import type { Activity, FechaISO } from "../dominio/tipos.js";
import type { Repositorio } from "./repositorio.js";
import { sembrar } from "./seed.js";

/** Lo comun a pool y conexion: cada repositorio lee y escribe por el que tiene atado. */
type Db = Pick<mariadb.Connection, "query">;
type Fila = Record<string, unknown>;

/** campo del dominio -> columna */
type Mapa = Record<string, string>;
const LIBRO: Mapa = { isbn: "isbn", titulo: "titulo", autor: "autor", editorial: "editorial", anio: "anio", categoria: "categoria", descripcion: "descripcion", activo: "activo" };
const EJEMPLAR: Mapa = { codigo: "codigo", isbn: "isbn", sede: "sede", estado: "estado" };
const PRESTAMO: Mapa = { id: "id", isbn: "isbn", copia: "copia", userId: "user_id", sede: "sede", fechaPrestamo: "fecha_prestamo", fechaLimite: "fecha_limite", fechaDevolucion: "fecha_devolucion", renovaciones: "renovaciones", codigoRetiro: "codigo_retiro", tieneReservas: "tiene_reservas" };
const SANCION: Mapa = { id: "id", loanId: "loan_id", userId: "user_id", isbn: "isbn", monto: "monto", diasAtraso: "dias_atraso", fechaLimiteOriginal: "fecha_limite_original", fechaDeteccion: "fecha_deteccion", fechaCobro: "fecha_cobro", estado: "estado" };
const NOTIFICACION: Mapa = { id: "id", userId: "user_id", tipo: "tipo", titulo: "titulo", cuerpo: "cuerpo", fecha: "fecha", leida: "leida" };
const TARIFA: Mapa = { monto: "monto", vigenteDesde: "vigente_desde" };
const UBICACION: Mapa = { locationId: "location_id", siteId: "site_id", name: "name", capacity: "capacity", status: "status" };
const BOOLEANOS = new Set(["activo", "tieneReservas", "leida"]);

// El connector devuelve BOOLEAN como 0/1 y DECIMAL como string.
function deFila<T>(fila: Fila, mapa: Mapa): T {
  const o: Fila = {};
  for (const [campo, col] of Object.entries(mapa)) {
    const v = fila[col];
    o[campo] = BOOLEANOS.has(campo) ? Boolean(v) : campo === "monto" ? Number(v) : v;
  }
  return o as T;
}

const actividadDeFila = (f: Fila): Activity => {
  const fh = f.fecha_hora as string; // "YYYY-MM-DD HH:MM:SS" (dateStrings)
  return { id: f.id, tipo: f.tipo, texto: f.texto, fecha: fh.slice(0, 10), hora: fh.slice(11, 16) } as Activity;
};

/** Consulta con fechas como string "YYYY-MM-DD": sin corrimientos por zona horaria. */
const q = (db: Db, sql: string, valores: unknown[] = []): Promise<any> => db.query({ sql, dateStrings: true }, valores);

const leer = async <T>(db: Db, tabla: string, mapa: Mapa, where = "", valores: unknown[] = []): Promise<T[]> =>
  ((await q(db, `SELECT * FROM ${tabla} ${where}`, valores)) as Fila[]).map((f) => deFila<T>(f, mapa));

/**
 * Upsert por PK: UPDATE y, si no habia fila, INSERT. No usa ON DUPLICATE KEY porque
 * pisaria la fila de otra UNIQUE (sanciones.loan_id) en vez de fallar.
 */
async function upsert(db: Db, tabla: string, mapa: Mapa, pk: string, obj: object): Promise<void> {
  const o = obj as Fila;
  const campos = Object.keys(mapa);
  const cols = campos.map((c) => mapa[c]);
  const vals = campos.map((c) => o[c]);
  const r = await q(db, `UPDATE ${tabla} SET ${cols.map((c) => `${c} = ?`).join(", ")} WHERE ${mapa[pk]} = ?`, [...vals, o[pk]]);
  if (r.affectedRows === 0) await insertar(db, tabla, cols, vals);
}

const insertar = (db: Db, tabla: string, cols: string[], vals: unknown[]) =>
  q(db, `INSERT INTO ${tabla} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, vals);

/** Repositorio atado a `db`; `pool` existe solo fuera de una transaccion. */
function repoSobre(db: Db, pool: mariadb.Pool | null): Repositorio {
  const uno = async <T>(l: Promise<T[]>) => (await l)[0];
  // Cola local: respeta el orden de llegada; el lock de la base serializa entre procesos.
  let cola: Promise<unknown> = Promise.resolve();
  const repo: Repositorio = {
    libros: () => leer(db, "libros", LIBRO),
    libro: (isbn) => uno(leer(db, "libros", LIBRO, "WHERE isbn = ?", [isbn])),
    guardarLibro: (l) => upsert(db, "libros", LIBRO, "isbn", l),
    ejemplares: (isbn) => (isbn ? leer(db, "ejemplares", EJEMPLAR, "WHERE isbn = ?", [isbn]) : leer(db, "ejemplares", EJEMPLAR)),
    async guardarEjemplares(cs) { for (const c of cs) await upsert(db, "ejemplares", EJEMPLAR, "codigo", c); },
    prestamos: () => leer(db, "prestamos", PRESTAMO),
    prestamo: (id) => uno(leer(db, "prestamos", PRESTAMO, "WHERE id = ?", [id])),
    guardarPrestamo: (l) => upsert(db, "prestamos", PRESTAMO, "id", l),
    guardarSancion: (p) => upsert(db, "sanciones", SANCION, "id", p),
    sanciones: () => leer(db, "sanciones", SANCION),
    sancion: (id) => uno(leer(db, "sanciones", SANCION, "WHERE id = ?", [id])),
    sancionDe: (loanId) => uno(leer(db, "sanciones", SANCION, "WHERE loan_id = ?", [loanId])),
    notificaciones: (userId) => leer(db, "notificaciones", NOTIFICACION, "WHERE user_id = ?", [userId]),
    async guardarNotificaciones(ns) { for (const n of ns) await upsert(db, "notificaciones", NOTIFICACION, "id", n); },
    async actividad() { return ((await q(db, "SELECT * FROM actividad")) as Fila[]).map(actividadDeFila); },
    async registrarActividad(a) {
      const vals = [a.tipo, a.texto, `${a.fecha} ${a.hora}:00`];
      const r = await q(db, "UPDATE actividad SET tipo = ?, texto = ?, fecha_hora = ? WHERE id = ?", [...vals, a.id]);
      if (r.affectedRows === 0) await insertar(db, "actividad", ["id", "tipo", "texto", "fecha_hora"], [a.id, ...vals]);
    },
    tarifas: () => leer(db, "tarifas", TARIFA),
    agregarTarifa: (t) => upsert(db, "tarifas", TARIFA, "vigenteDesde", t),
    ubicaciones: () => leer(db, "ubicaciones", UBICACION),
    guardarUbicacion: (l) => upsert(db, "ubicaciones", UBICACION, "locationId", l),
    async siguienteId(tipo) {
      // LAST_INSERT_ID(expr) deja el valor previo en insertId: lee e incrementa en un solo paso atomico.
      const r = await q(db, "UPDATE secuencias SET valor = LAST_INSERT_ID(valor) + 1 WHERE nombre = ?", [tipo]);
      const n = Number(r.insertId);
      return tipo === "prestamo" ? `PRE-${n}` : `SAN-${String(n).padStart(5, "0")}`;
    },
    transaccion(trabajo) {
      if (!pool) return Promise.reject(new Error("No se soportan transacciones anidadas"));
      const turno = cola.then(() => ejecutar(pool, trabajo));
      cola = turno.catch(() => undefined);
      return turno;
    },
  };
  return repo;
}

/** Una transaccion en su propia conexion: BEGIN, lock global, trabajo, COMMIT o ROLLBACK. */
async function ejecutar<T>(pool: mariadb.Pool, trabajo: (repo: Repositorio, con: Db) => Promise<T>): Promise<T> {
  const con = await pool.getConnection();
  try {
    await con.beginTransaction();
    // shortcut: un lock global serializa todas las escrituras; alcanza para una biblioteca, pasar a locks por fila si hay contención
    await q(con, "SELECT valor FROM secuencias WHERE nombre = 'lock' FOR UPDATE");
    const r = await trabajo(repoSobre(con, null), con);
    await con.commit();
    return r;
  } catch (e) {
    await con.rollback().catch(() => undefined);
    throw e;
  } finally {
    await con.release();
  }
}

const ESQUEMA = readFileSync(new URL("./esquema.sql", import.meta.url), "utf8");

/** Aplica esquema.sql (CREATE TABLE IF NOT EXISTS) y siembra si `libros` esta vacia. */
export async function crearRepositorioMariaDB(pool: mariadb.Pool, hoy: FechaISO): Promise<Repositorio> {
  for (const sentencia of ESQUEMA.split(";").filter((s) => s.trim())) await pool.query(sentencia);
  await ejecutar(pool, async (r, con) => {
    const [{ n }] = await q(con, "SELECT COUNT(*) AS n FROM libros FOR UPDATE");
    if (Number(n) > 0) return;
    const d = sembrar(hoy);
    for (const l of d.libros) await r.guardarLibro(l);
    await r.guardarEjemplares(d.ejemplares);
    for (const p of d.prestamos) await r.guardarPrestamo(p);
    for (const s of d.sanciones) await r.guardarSancion(s);
    await r.guardarNotificaciones(d.notificaciones);
    for (const a of d.actividad) await r.registrarActividad(a);
    for (const t of d.tarifas) await r.agregarTarifa(t);
    for (const u of d.ubicaciones) await r.guardarUbicacion(u);
    for (const [nombre, valor] of [["prestamo", d.secuencias.prestamo], ["sancion", d.secuencias.sancion], ["lock", 0]])
      await insertar(con, "secuencias", ["nombre", "valor"], [nombre, valor]);
  });
  return repoSobre(pool, pool);
}

/** Solo para tests: borra todas las tablas (hijas primero por las FK). */
export async function borrarEsquema(pool: mariadb.Pool): Promise<void> {
  await pool.query(
    "DROP TABLE IF EXISTS sanciones, prestamos, ejemplares, libros, notificaciones, actividad, tarifas, ubicaciones, secuencias",
  );
}
