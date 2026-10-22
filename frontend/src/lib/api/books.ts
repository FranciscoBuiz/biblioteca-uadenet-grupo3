import type {
  Book,
  BookWithStock,
  Categoria,
  Copy,
  EstadoEjemplar,
  SedeId,
} from "@/lib/domain/types";
import {
  aEjemplar,
  aIndicadores,
  aLibro,
  aLibroConStock,
  type BookDto,
  type BookWithStockDto,
  type CopyDto,
  type Indicadores,
  type IndicatorsDto,
} from "./adaptadores";
import { ApiError } from "./errors";
import { consulta, pedir } from "./http";

/* ---------------------------------------------------------------
   GET   /api/v1/library/books?q=algoritmos
   GET   /api/v1/library/books/{isbn}
   POST  /api/v1/library/books
   PUT   /api/v1/library/books/{isbn}
   PATCH /api/v1/library/books/{isbn}
   POST  /api/v1/library/books/{isbn}/copies
   PATCH /api/v1/library/books/{isbn}/copies/{code}
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

const ORDEN = { recientes: "recent", titulo: "title", disponibilidad: "availability" } as const;

export async function getBooks(
  filtro: FiltroCatalogo = {},
): Promise<BookWithStock[]> {
  const { q, sede, categoria, soloStock, incluirInactivos, orden } = filtro;
  const libros = await pedir<BookWithStockDto[]>(
    "GET",
    `/books${consulta({
      q: q?.trim(),
      siteId: sede === "todas" ? undefined : sede,
      category: categoria === "Todas" ? undefined : categoria,
      inStock: soloStock,
      includeInactive: incluirInactivos,
      sort: orden && ORDEN[orden],
    })}`,
  );
  return libros.map(aLibroConStock);
}

export async function getBook(isbn: string): Promise<BookWithStock> {
  return aLibroConStock(await pedir<BookWithStockDto>("GET", `/books/${encodeURIComponent(isbn)}`));
}

export async function getCopies(isbn: string): Promise<Copy[]> {
  const lista = await pedir<CopyDto[]>("GET", `/books/${encodeURIComponent(isbn)}/copies`);
  return lista.map(aEjemplar);
}

/** Categorias presentes en el catalogo activo, para los chips de filtro. */
export async function getCategorias(): Promise<string[]> {
  return pedir<string[]>("GET", "/categories");
}

/** Contadores de inventario, opcionalmente acotados a una sede. */
export async function getIndicadores(sede: SedeId | "todas" = "todas"): Promise<Indicadores> {
  return aIndicadores(
    await pedir<IndicatorsDto>("GET", `/indicators${consulta({ siteId: sede === "todas" ? undefined : sede })}`),
  );
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

/** Los campos de un titulo tal como los espera el backend. */
const cuerpoLibro = (d: Omit<AltaLibro, "isbn" | "sede" | "cantidad">) => ({
  title: d.titulo.trim(),
  author: d.autor.trim(),
  publisher: d.editorial.trim(),
  year: d.anio,
  category: d.categoria,
  description: d.descripcion.trim(),
});

export async function createBook(datos: AltaLibro): Promise<Book> {
  const creado = await pedir<BookWithStockDto>("POST", "/books", {
    isbn: datos.isbn.trim(),
    ...cuerpoLibro(datos),
    siteId: datos.sede,
    quantity: datos.cantidad,
  });
  return aLibro(creado);
}

/** Campos editables de un titulo. El ISBN no se toca porque lo identifica. */
export type EdicionLibro = Omit<Book, "isbn" | "activo">;

export async function updateBook(
  isbn: string,
  datos: EdicionLibro,
): Promise<Book> {
  return aLibro(await pedir<BookDto>("PUT", `/books/${encodeURIComponent(isbn)}`, cuerpoLibro(datos)));
}

/** Baja logica y reactivacion de un titulo (acciones de la pantalla 15). */
export async function setBookActivo(isbn: string, activo: boolean): Promise<void> {
  await pedir<BookDto>("PATCH", `/books/${encodeURIComponent(isbn)}`, { active: activo });
}

export async function addCopies(
  isbn: string,
  sede: SedeId,
  cantidad: number,
): Promise<Copy[]> {
  const nuevos = await pedir<CopyDto[]>("POST", `/books/${encodeURIComponent(isbn)}/copies`, {
    siteId: sede,
    quantity: cantidad,
  });
  return nuevos.map(aEjemplar);
}

const ESTADO_EJEMPLAR: Partial<Record<EstadoEjemplar, string>> = {
  disponible: "available",
  mantenimiento: "maintenance",
  baja: "retired",
};

/** Cambia el estado de un ejemplar fisico (pantalla 19). */
export async function setCopyEstado(
  isbn: string,
  codigo: string,
  estado: EstadoEjemplar,
): Promise<void> {
  const status = ESTADO_EJEMPLAR[estado];
  if (!status) throw new ApiError("Ese estado no se puede asignar a mano.");
  await pedir<CopyDto>(
    "PATCH",
    `/books/${encodeURIComponent(isbn)}/copies/${encodeURIComponent(codigo)}`,
    { status },
  );
}
