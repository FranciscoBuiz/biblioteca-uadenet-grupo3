import { randomUUID } from "node:crypto";
import type { Repositorio } from "../datos/repositorio.js";
import type { Book, FechaISO, Lector, TipoActividad } from "../dominio/tipos.js";
import type { PuertoCore } from "../integracion/core.js";

/** Id unico y legible: dos llamadas en el mismo instante no colisionan. */
export function nuevoId(prefijo: string): string {
  return `${prefijo}-${randomUUID()}`;
}

function horaActual(): string {
  const ahora = new Date();
  return `${String(ahora.getHours()).padStart(2, "0")}:${String(ahora.getMinutes()).padStart(2, "0")}`;
}

export async function registrarActividad(
  repo: Repositorio,
  tipo: TipoActividad,
  texto: string,
  hoy: FechaISO,
): Promise<void> {
  await repo.registrarActividad({ id: nuevoId("ACT"), tipo, texto, fecha: hoy, hora: horaActual() });
}

export interface Contexto {
  repo: Repositorio;
  core: PuertoCore;
  hoy: FechaISO;
  correlationId: string;
}

/** Lectores por id en un solo pedido al CORE; los que falten quedan como desconocidos. */
export async function lectoresPorId(ctx: Contexto, ids: string[]): Promise<(id: string) => Lector> {
  const unicos = [...new Set(ids)];
  const lectores = unicos.length ? await ctx.core.lectores(unicos, ctx.correlationId) : [];
  return (id) => lectores.find((l) => l.id === id) ?? estudianteDesconocido(id);
}

/** Nombre para textos de actividad: si el CORE no responde, no bloquea la operacion. */
export async function nombreDe(ctx: Contexto, userId: string): Promise<string> {
  try {
    return (await ctx.core.lectores([userId], ctx.correlationId))[0]?.nombre ?? "Estudiante";
  } catch {
    return "Estudiante";
  }
}

function estudianteDesconocido(id: string): Lector {
  return {
    id,
    nombre: "Estudiante no disponible",
    email: "—",
    legajo: "—",
    dni: "—",
    rol: "estudiante",
    sedeDefault: "monserrat",
    iniciales: "??",
    etiqueta: "Estudiante",
  };
}

/** Marcador para un ISBN sin ficha, para que la UI nunca reviente. */
export function libroDesconocido(isbn: string): Book {
  return {
    isbn,
    titulo: "Título no disponible",
    autor: "—",
    editorial: "—",
    anio: 0,
    categoria: "Sistemas",
    descripcion: "",
    activo: false,
  };
}
