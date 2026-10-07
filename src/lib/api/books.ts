import { nombreSede, validarIsbn } from "@/lib/domain/rules";
import type {
  Book,
  BookWithStock,
  Categoria,
  Copy,
  EstadoEjemplar,
  SedeId,
} from "@/lib/domain/types";
import { demora, getDb, mutar } from "@/lib/store/db";
import { buscarLibro, ejemplaresDe, librosConStock } from "@/lib/store/selectors";
import { ApiError } from "./errors";
import { nuevaActividad } from "./internal";

/* ---------------------------------------------------------------
   GET  /api/v1/library/books?q=algoritmos
   GET  /api/v1/library/books/{isbn}
   POST /api/v1/library/books
   PUT  /api/v1/library/books/{isbn}
   POST /api/v1/library/books/{isbn}/copies
   --------------------------------------------------------------- */

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

export async function getBooks(
  filtro: FiltroCatalogo = {},
): Promise<BookWithStock[]> {
  await demora();

  const {
    q = "",
    sede = "todas",
    categoria,
    soloStock = false,
    incluirInactivos = false,
    orden = "recientes",
  } = filtro;

  const texto = q.trim().toLowerCase();
  let resultado = librosConStock(getDb());

  if (!incluirInactivos) {
    resultado = resultado.filter((l) => l.activo);
  }

  if (texto) {
    resultado = resultado.filter(
      (l) =>
        l.titulo.toLowerCase().includes(texto) ||
        l.autor.toLowerCase().includes(texto) ||
        l.isbn.includes(texto),
    );
  }

  if (categoria && categoria !== "Todas") {
    resultado = resultado.filter((l) => l.categoria === categoria);
  }

  if (soloStock) {
    resultado = resultado.filter((l) =>
      sede === "todas" ? l.disponibles > 0 : l.porSede[sede] > 0,
    );
  }

  const comparadores: Record<string, (a: BookWithStock, b: BookWithStock) => number> = {
    titulo: (a, b) => a.titulo.localeCompare(b.titulo),
    disponibilidad: (a, b) => b.disponibles - a.disponibles,
    recientes: (a, b) => b.anio - a.anio,
  };

  return [...resultado].sort(comparadores[orden] ?? comparadores.recientes);
}

export async function getBook(isbn: string): Promise<BookWithStock> {
  await demora();
  const libro = buscarLibro(getDb(), isbn);
  if (!libro) throw new ApiError("No encontramos ese título en el catálogo.", 404);
  return libro;
}

export async function getCopies(isbn: string): Promise<Copy[]> {
  await demora();
  return ejemplaresDe(getDb(), isbn);
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

export async function createBook(datos: AltaLibro): Promise<Book> {
  await demora();

  const errorIsbn = validarIsbn(datos.isbn);
  if (errorIsbn) throw new ApiError(errorIsbn);

  const isbn = datos.isbn.replace(/[\s-]/g, "");
  if (getDb().libros.some((l) => l.isbn === isbn)) {
    throw new ApiError("Ya existe un título con ese ISBN en el catálogo.", 409);
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

  mutar((db) => ({
    libros: [libro, ...db.libros],
    ejemplares: [...db.ejemplares, ...generarEjemplares(db.ejemplares, isbn, datos.sede, datos.cantidad)],
    actividad: [
      nuevaActividad(
        "alta_ejemplar",
        `Alta de ${datos.cantidad} ${datos.cantidad === 1 ? "ejemplar" : "ejemplares"} · ${libro.titulo} — ${nombreSede(datos.sede)}`,
      ),
      ...db.actividad,
    ],
  }));

  return libro;
}

/** Campos editables de un titulo. El ISBN no se toca porque lo identifica. */
export type EdicionLibro = Omit<Book, "isbn" | "activo">;

export async function updateBook(
  isbn: string,
  datos: EdicionLibro,
): Promise<Book> {
  await demora();

  const existente = getDb().libros.find((l) => l.isbn === isbn);
  if (!existente) throw new ApiError("No encontramos ese título.", 404);

  const actualizado: Book = {
    ...existente,
    ...datos,
    titulo: datos.titulo.trim(),
    autor: datos.autor.trim(),
    editorial: datos.editorial.trim(),
    descripcion: datos.descripcion.trim(),
  };

  mutar((db) => ({
    libros: db.libros.map((l) => (l.isbn === isbn ? actualizado : l)),
  }));

  return actualizado;
}

/** Baja logica y reactivacion de un titulo (acciones de la pantalla 15). */
export async function setBookActivo(isbn: string, activo: boolean): Promise<void> {
  await demora();

  const db = getDb();
  const libro = db.libros.find((l) => l.isbn === isbn);
  if (!libro) throw new ApiError("No encontramos ese título.", 404);

  if (!activo) {
    const prestados = db.ejemplares.filter(
      (e) => e.isbn === isbn && e.estado === "prestado",
    ).length;
    if (prestados > 0) {
      throw new ApiError(
        `No se puede dar de baja: hay ${prestados} ${prestados === 1 ? "ejemplar prestado" : "ejemplares prestados"} sin devolver.`,
      );
    }
  }

  mutar((actual) => ({
    libros: actual.libros.map((l) => (l.isbn === isbn ? { ...l, activo } : l)),
  }));
}

export async function addCopies(
  isbn: string,
  sede: SedeId,
  cantidad: number,
): Promise<Copy[]> {
  await demora();

  const db = getDb();
  const libro = db.libros.find((l) => l.isbn === isbn);
  if (!libro) throw new ApiError("No encontramos ese título.", 404);
  if (cantidad < 1) throw new ApiError("La cantidad debe ser mayor a cero.");

  const nuevos = generarEjemplares(db.ejemplares, isbn, sede, cantidad);

  mutar((actual) => ({
    ejemplares: [...actual.ejemplares, ...nuevos],
    actividad: [
      nuevaActividad(
        "alta_ejemplar",
        `Alta de ${cantidad} ${cantidad === 1 ? "ejemplar" : "ejemplares"} · ${libro.titulo} — ${nombreSede(sede)}`,
      ),
      ...actual.actividad,
    ],
  }));

  return nuevos;
}

/** Cambia el estado de un ejemplar fisico (pantalla 19). */
export async function setCopyEstado(
  codigo: string,
  estado: EstadoEjemplar,
): Promise<void> {
  await demora();

  const ejemplar = getDb().ejemplares.find((e) => e.codigo === codigo);
  if (!ejemplar) throw new ApiError("No encontramos ese ejemplar.", 404);
  if (ejemplar.estado === "prestado") {
    throw new ApiError(
      "El ejemplar está prestado: registrá la devolución antes de cambiar su estado.",
    );
  }

  mutar((db) => ({
    ejemplares: db.ejemplares.map((e) =>
      e.codigo === codigo ? { ...e, estado } : e,
    ),
  }));
}

/* --- Helpers -------------------------------------------------- */

/** Genera codigos de inventario correlativos tipo BA-032, BA-033... */
function generarEjemplares(
  existentes: Copy[],
  isbn: string,
  sede: SedeId,
  cantidad: number,
): Copy[] {
  const maximo = existentes.reduce((max, e) => {
    const numero = Number(e.codigo.replace(/\D/g, ""));
    return Number.isFinite(numero) && numero > max ? numero : max;
  }, 0);

  return Array.from({ length: cantidad }, (_, i) => ({
    codigo: `BA-${String(maximo + i + 1).padStart(3, "0")}`,
    isbn,
    sede,
    estado: "disponible" as const,
  }));
}
