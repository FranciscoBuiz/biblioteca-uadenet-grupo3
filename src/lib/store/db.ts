import type {
  Activity,
  Book,
  Copy,
  Loan,
  Notification,
  Penalty,
  SedeId,
  User,
} from "@/lib/domain/types";
import {
  ACTIVIDAD,
  EJEMPLARES,
  LIBROS,
  NOTIFICACIONES,
  PRESTAMOS,
  SANCIONES,
  SECUENCIAS,
  USUARIOS,
} from "./seed";

/* ---------------------------------------------------------------
   Base de datos en memoria que hace de backend falso.

   Vive fuera de React a proposito: lib/api/* la lee y la escribe
   con funciones async, igual que harian contra el CORE Gateway, y
   los componentes se enteran de los cambios suscribiendose. El dia
   que exista la API real se borra este archivo y solo cambia el
   cuerpo de lib/api/*.
   --------------------------------------------------------------- */

export interface Db {
  usuarios: User[];
  libros: Book[];
  ejemplares: Copy[];
  prestamos: Loan[];
  sanciones: Penalty[];
  notificaciones: Notification[];
  actividad: Activity[];
  secuencias: { prestamo: number; sancion: number };
  /** id del usuario con la sesion abierta, null si nadie inicio sesion. */
  sesion: string | null;
  /** Sede seleccionada en la cabecera; es el default de catalogo y stock. */
  sedeActiva: SedeId;
}

const CLAVE = "uadenet-biblioteca-v1";

function estadoInicial(): Db {
  return {
    usuarios: USUARIOS,
    libros: LIBROS,
    ejemplares: EJEMPLARES,
    prestamos: PRESTAMOS,
    sanciones: SANCIONES,
    notificaciones: NOTIFICACIONES,
    actividad: ACTIVIDAD,
    secuencias: { ...SECUENCIAS },
    sesion: null,
    sedeActiva: "monserrat",
  };
}

/**
 * Copia profunda del estado inicial. Las constantes del seed se comparten
 * entre recargas, asi que clonamos para que ninguna mutacion las contamine.
 */
function semillaFresca(): Db {
  return structuredClone(estadoInicial());
}

let db: Db = semillaFresca();
let hidratada = false;

const oyentes = new Set<() => void>();

function persistir(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CLAVE, JSON.stringify(db));
  } catch {
    // Modo privado o cuota llena: la demo sigue funcionando en memoria.
  }
}

function notificar(): void {
  oyentes.forEach((oyente) => oyente());
}

/**
 * Carga lo guardado en localStorage. Se llama una sola vez desde el
 * provider, ya en el cliente, para no romper la hidratacion.
 */
export function hidratar(): void {
  if (hidratada || typeof window === "undefined") return;
  hidratada = true;
  try {
    const guardado = window.localStorage.getItem(CLAVE);
    if (guardado) {
      const parseado = JSON.parse(guardado) as Partial<Db>;
      // Mezclamos sobre la semilla para tolerar datos de versiones viejas.
      db = { ...semillaFresca(), ...parseado };
    }
  } catch {
    db = semillaFresca();
  }
  notificar();
}

export function getDb(): Db {
  return db;
}

export function suscribir(oyente: () => void): () => void {
  oyentes.add(oyente);
  return () => {
    oyentes.delete(oyente);
  };
}

/** Aplica un cambio, persiste y avisa a los componentes suscriptos. */
export function mutar(cambio: (actual: Db) => Partial<Db>): void {
  db = { ...db, ...cambio(db) };
  persistir();
  notificar();
}

/** Vuelve la demo a los datos de la maqueta, conservando la sesion. */
export function reiniciarDemo(): void {
  const sesion = db.sesion;
  db = { ...semillaFresca(), sesion };
  persistir();
  notificar();
}

/** Simula la latencia de una llamada de red para que la UI muestre su estado de carga. */
export function demora(ms = 180): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
