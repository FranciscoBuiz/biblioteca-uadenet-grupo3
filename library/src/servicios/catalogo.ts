import type { Repositorio } from "../datos/repositorio.js";
import { nombreSede, validarIsbn } from "../dominio/reglas.js";
import type {
  Book,
  BookWithStock,
  Categoria,
  Copy,
  EstadoEjemplar,
  FechaISO,
  SedeId,
} from "../dominio/tipos.js";
import { ErrorNegocio } from "./errores.js";
import { registrarActividad } from "./comun.js";

export interface FiltroCatalogo {
  /** Texto libre: busca en titulo, autor e ISBN. */
  q?: string;
  sede?: SedeId | "todas";
  categoria?: string;
  soloStock?: boolean;
  /** Por defecto solo devuelve titulos activos. */
  incluirInactivos?: boolean;
  orden?: "recientes" | "titulo" | "disponibilidad";
}

export interface AltaLibro {
  isbn: string;
  titulo: string;
  autor: string;
  editorial: string;
  anio: number;
  categoria: Categoria;
  descripcion: string;
  /** Sede donde ingresan los primeros ejemplares. */
  sede: SedeId;
  cantidad: number;
}

const SEDES_VACIAS: Record<SedeId, number> = { monserrat: 0, belgrano: 0, pinamar: 0 };

function conStock(libro: Book, ejemplares: Copy[]): BookWithStock {
  const vigentes = ejemplares.filter((e) => e.isbn === libro.isbn && e.estado !== "baja");
  const porSede = { ...SEDES_VACIAS };
  for (const e of vigentes) if (e.estado === "disponible") porSede[e.sede] += 1;
  return {
    ...libro,
    totales: vigentes.length,
    disponibles: vigentes.filter((e) => e.estado === "disponible").length,
    prestados: vigentes.filter((e) => e.estado === "prestado").length,
    porSede,
  };
}

const noHayLibro = () => new ErrorNegocio("NOT_FOUND", "No encontramos ese título.", 404);

function validarCantidad(cantidad: number): void {
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    throw new ErrorNegocio("INVALID_QUANTITY", "La cantidad debe ser mayor a cero.");
  }
  if (cantidad > 50) {
    throw new ErrorNegocio("INVALID_QUANTITY", "No se pueden ingresar más de 50 ejemplares por vez.");
  }
}

const textoEjemplares = (n: number) => `${n} ${n === 1 ? "ejemplar" : "ejemplares"}`;

export async function listarLibros(repo: Repositorio, filtro: FiltroCatalogo = {}): Promise<BookWithStock[]> {
  const { q = "", sede = "todas", categoria, soloStock = false, incluirInactivos = false, orden = "recientes" } = filtro;
  const texto = q.trim().toLowerCase();
  const [libros, ejemplares] = await Promise.all([repo.libros(), repo.ejemplares()]);
  let resultado = libros.map((l) => conStock(l, ejemplares));

  if (!incluirInactivos) resultado = resultado.filter((l) => l.activo);
  if (texto) {
    resultado = resultado.filter(
      (l) => l.titulo.toLowerCase().includes(texto) || l.autor.toLowerCase().includes(texto) || l.isbn.includes(texto),
    );
  }
  if (categoria && categoria !== "Todas") resultado = resultado.filter((l) => l.categoria === categoria);
  if (soloStock) resultado = resultado.filter((l) => (sede === "todas" ? l.disponibles > 0 : l.porSede[sede] > 0));

  const comparadores: Record<string, (a: BookWithStock, b: BookWithStock) => number> = {
    titulo: (a, b) => a.titulo.localeCompare(b.titulo),
    disponibilidad: (a, b) => b.disponibles - a.disponibles,
    recientes: (a, b) => b.anio - a.anio,
  };
  // desempate por ISBN: el repositorio no garantiza orden
  const cmp = comparadores[orden] ?? comparadores.recientes;
  return resultado.sort((a, b) => cmp(a, b) || a.isbn.localeCompare(b.isbn));
}

export async function obtenerLibro(repo: Repositorio, isbn: string): Promise<BookWithStock> {
  const libro = await repo.libro(isbn);
  if (!libro) throw new ErrorNegocio("NOT_FOUND", "No encontramos ese título en el catálogo.", 404);
  return conStock(libro, await repo.ejemplares(isbn));
}

/** Codigos de inventario correlativos tipo BA-032, BA-033... */
function generarEjemplares(existentes: Copy[], isbn: string, sede: SedeId, cantidad: number): Copy[] {
  const maximo = existentes.reduce((max, e) => {
    const n = Number(e.codigo.replace(/\D/g, ""));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0);
  return Array.from({ length: cantidad }, (_, i) => ({
    codigo: `BA-${String(maximo + i + 1).padStart(3, "0")}`,
    isbn,
    sede,
    estado: "disponible" as const,
  }));
}

export async function crearLibro(repo: Repositorio, datos: AltaLibro, hoy: FechaISO): Promise<Book> {
  const errorIsbn = validarIsbn(datos.isbn);
  if (errorIsbn) throw new ErrorNegocio("INVALID_ISBN", errorIsbn);
  validarCantidad(datos.cantidad);
  const isbn = datos.isbn.replace(/[\s-]/g, "");

  return repo.transaccion(async (r) => {
    if (await r.libro(isbn)) {
      throw new ErrorNegocio("BOOK_EXISTS", "Ya existe un título con ese ISBN en el catálogo.", 409);
    }
    const libro: Book = {
      isbn,
      titulo: datos.titulo.trim(),
      autor: datos.autor.trim(),
      editorial: datos.editorial.trim(),
      anio: datos.anio,
      categoria: datos.categoria,
      descripcion: datos.descripcion.trim(),
      activo: true,
    };
    await r.guardarLibro(libro);
    await r.guardarEjemplares(generarEjemplares(await r.ejemplares(), isbn, datos.sede, datos.cantidad));
    await registrarActividad(
      r,
      "alta_ejemplar",
      `Alta de ${textoEjemplares(datos.cantidad)} · ${libro.titulo} — ${nombreSede(datos.sede)}`,
      hoy,
    );
    return libro;
  });
}

export async function editarLibro(
  repo: Repositorio,
  isbn: string,
  cambios: Partial<Omit<Book, "isbn" | "activo">>,
): Promise<Book> {
  return repo.transaccion(async (r) => {
    const existente = await r.libro(isbn);
    if (!existente) throw noHayLibro();
    // solo campos editables, explicitos: isbn y activo de "cambios" se ignoran
    const { titulo, autor, editorial, anio, categoria, descripcion } = { ...existente, ...cambios };
    const actualizado: Book = {
      ...existente,
      titulo: titulo.trim(),
      autor: autor.trim(),
      editorial: editorial.trim(),
      anio,
      categoria,
      descripcion: descripcion.trim(),
    };
    await r.guardarLibro(actualizado);
    return actualizado;
  });
}

/** Baja logica y reactivacion de un titulo. */
export async function activarLibro(repo: Repositorio, isbn: string, activo: boolean): Promise<Book> {
  return repo.transaccion(async (r) => {
    const libro = await r.libro(isbn);
    if (!libro) throw noHayLibro();
    if (!activo) {
      const prestados = (await r.ejemplares(isbn)).filter((e) => e.estado === "prestado").length;
      if (prestados > 0) {
        throw new ErrorNegocio(
          "COPIES_ON_LOAN",
          `No se puede dar de baja: hay ${prestados} ${prestados === 1 ? "ejemplar prestado" : "ejemplares prestados"} sin devolver.`,
          409,
        );
      }
    }
    const actualizado = { ...libro, activo };
    await r.guardarLibro(actualizado);
    return actualizado;
  });
}

/** Ejemplares de un titulo, ordenados por codigo. */
export async function listarEjemplares(repo: Repositorio, isbn: string): Promise<Copy[]> {
  return (await repo.ejemplares(isbn)).sort((a, b) => a.codigo.localeCompare(b.codigo));
}

export async function agregarEjemplares(
  repo: Repositorio,
  isbn: string,
  sede: SedeId,
  cantidad: number,
  hoy: FechaISO,
): Promise<Copy[]> {
  return repo.transaccion(async (r) => {
    const libro = await r.libro(isbn);
    if (!libro) throw noHayLibro();
    validarCantidad(cantidad);
    const nuevos = generarEjemplares(await r.ejemplares(), isbn, sede, cantidad);
    await r.guardarEjemplares(nuevos);
    await registrarActividad(
      r,
      "alta_ejemplar",
      `Alta de ${textoEjemplares(cantidad)} · ${libro.titulo} — ${nombreSede(sede)}`,
      hoy,
    );
    return nuevos;
  });
}

/** Cambia el estado de un ejemplar fisico. */
export async function cambiarEstadoEjemplar(
  repo: Repositorio,
  isbn: string,
  codigo: string,
  estado: EstadoEjemplar,
): Promise<Copy> {
  return repo.transaccion(async (r) => {
    const ejemplar = (await r.ejemplares(isbn)).find((e) => e.codigo === codigo);
    if (!ejemplar) throw new ErrorNegocio("NOT_FOUND", "No encontramos ese ejemplar.", 404);
    if (ejemplar.estado === "prestado") {
      throw new ErrorNegocio(
        "COPY_ON_LOAN",
        "El ejemplar está prestado: registrá la devolución antes de cambiar su estado.",
        409,
      );
    }
    const actualizado = { ...ejemplar, estado };
    await r.guardarEjemplares([actualizado]);
    return actualizado;
  });
}

/** Categorias presentes en el catalogo activo. */
export async function categorias(repo: Repositorio): Promise<string[]> {
  return [...new Set((await repo.libros()).filter((l) => l.activo).map((l) => l.categoria))];
}
