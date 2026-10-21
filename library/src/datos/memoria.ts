import type { FechaISO } from "../dominio/tipos.js";
import type { Repositorio } from "./repositorio.js";
import { sembrar, type DatosSeed } from "./seed.js";

/** Upsert por clave: reemplaza si existe, agrega si no. */
function upsert<T>(lista: T[], item: T, mismo: (a: T) => boolean): void {
  const i = lista.findIndex(mismo);
  if (i >= 0) lista[i] = item;
  else lista.push(item);
}

const copia = <T>(x: T): T => structuredClone(x);

/** Repositorio en memoria, sembrado y corrido para que "hoy" sea `hoy`. */
export function crearRepositorioEnMemoria(hoy: FechaISO): Repositorio {
  let d: DatosSeed = sembrar(hoy);
  // Cola de transacciones: cada una espera a la anterior (mutex).
  let cola: Promise<unknown> = Promise.resolve();

  const repo: Repositorio = {
    async libros() { return copia(d.libros); },
    async libro(isbn) { return copia(d.libros.find((l) => l.isbn === isbn)); },
    async guardarLibro(l) { upsert(d.libros, copia(l), (x) => x.isbn === l.isbn); },
    async ejemplares(isbn) { return copia(isbn ? d.ejemplares.filter((c) => c.isbn === isbn) : d.ejemplares); },
    async guardarEjemplares(cs) { for (const c of cs) upsert(d.ejemplares, copia(c), (x) => x.codigo === c.codigo); },
    async prestamos() { return copia(d.prestamos); },
    async prestamo(id) { return copia(d.prestamos.find((p) => p.id === id)); },
    async guardarPrestamo(l) { upsert(d.prestamos, copia(l), (x) => x.id === l.id); },
    async guardarSancion(p) { upsert(d.sanciones, copia(p), (x) => x.id === p.id); },
    async sanciones() { return copia(d.sanciones); },
    async sancion(id) { return copia(d.sanciones.find((s) => s.id === id)); },
    async sancionDe(loanId) { return copia(d.sanciones.find((s) => s.loanId === loanId)); },
    async notificaciones(userId) { return copia(d.notificaciones.filter((n) => n.userId === userId)); },
    async guardarNotificaciones(ns) { for (const n of ns) upsert(d.notificaciones, copia(n), (x) => x.id === n.id); },
    async actividad() { return copia(d.actividad); },
    async registrarActividad(a) { upsert(d.actividad, copia(a), (x) => x.id === a.id); },
    async tarifas() { return copia(d.tarifas); },
    // Upsert por vigenteDesde: una tarifa nueva el mismo dia pisa la anterior.
    async agregarTarifa(t) { upsert(d.tarifas, copia(t), (x) => x.vigenteDesde === t.vigenteDesde); },
    async ubicaciones() { return copia(d.ubicaciones); },
    async guardarUbicacion(l) { upsert(d.ubicaciones, copia(l), (x) => x.locationId === l.locationId); },
    async siguienteId(tipo) {
      if (tipo === "prestamo") return `PRE-${d.secuencias.prestamo++}`;
      return `SAN-${String(d.secuencias.sancion++).padStart(5, "0")}`;
    },
    transaccion(trabajo) {
      const turno = cola.then(async () => {
        const respaldo = structuredClone(d);
        try {
          return await trabajo(repo);
        } catch (e) {
          d = respaldo;
          throw e;
        }
      });
      cola = turno.catch(() => undefined);
      return turno;
    },
  };
  return repo;
}
