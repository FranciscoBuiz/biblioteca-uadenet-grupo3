import {
  diasAtraso,
  diasRestantes,
  estadoPrestamo,
  HOY,
} from "@/lib/domain/rules";
import type {
  Book,
  BookWithStock,
  Copy,
  EstadoEjemplar,
  Loan,
  LoanView,
  Notification,
  Penalty,
  PenaltyView,
  SedeId,
  User,
} from "@/lib/domain/types";
import type { Db } from "./db";

/* ---------------------------------------------------------------
   Vistas derivadas. Todo lo que es calculable se calcula aca en
   vez de guardarse, asi los contadores nunca quedan desfasados del
   dato real.
   --------------------------------------------------------------- */

const SEDES_VACIAS: Record<SedeId, number> = {
  monserrat: 0,
  belgrano: 0,
  pinamar: 0,
};

/** Agrega a un libro sus contadores de ejemplares y el stock por sede. */
export function conStock(libro: Book, ejemplares: Copy[]): BookWithStock {
  const propios = ejemplares.filter((e) => e.isbn === libro.isbn);
  const vigentes = propios.filter((e) => e.estado !== "baja");
  const porSede = { ...SEDES_VACIAS };

  for (const ejemplar of vigentes) {
    if (ejemplar.estado === "disponible") porSede[ejemplar.sede] += 1;
  }

  return {
    ...libro,
    totales: vigentes.length,
    disponibles: vigentes.filter((e) => e.estado === "disponible").length,
    prestados: vigentes.filter((e) => e.estado === "prestado").length,
    porSede,
  };
}

export function librosConStock(db: Db): BookWithStock[] {
  return db.libros.map((libro) => conStock(libro, db.ejemplares));
}

export function buscarLibro(db: Db, isbn: string): BookWithStock | null {
  const libro = db.libros.find((l) => l.isbn === isbn);
  return libro ? conStock(libro, db.ejemplares) : null;
}

/** Ejemplares vigentes de un titulo, ordenados por codigo. */
export function ejemplaresDe(db: Db, isbn: string): Copy[] {
  return db.ejemplares
    .filter((e) => e.isbn === isbn)
    .sort((a, b) => a.codigo.localeCompare(b.codigo));
}

/** Sancion abierta o cerrada asociada a un prestamo. */
export function sancionDe(db: Db, loanId: string): Penalty | null {
  return db.sanciones.find((s) => s.loanId === loanId) ?? null;
}

/** Enriquece un prestamo con su libro, estado calculado y dias. */
export function vistaPrestamo(db: Db, loan: Loan, hoy = HOY): LoanView {
  const libro = db.libros.find((l) => l.isbn === loan.isbn);
  const estudiante = db.usuarios.find((u) => u.id === loan.userId);
  const sancion = sancionDe(db, loan.id);

  return {
    ...loan,
    libro: libro ?? libroDesconocido(loan.isbn),
    estudiante: estudiante ?? estudianteDesconocido(loan.userId),
    estado: estadoPrestamo(loan, sancion, hoy),
    diasRestantes: diasRestantes(loan, hoy),
    diasAtraso: diasAtraso(loan, hoy),
    sancion,
  };
}

/** Marcador para un ISBN sin ficha, para que la UI nunca reviente. */
function libroDesconocido(isbn: string): Book {
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

/** Todos los prestamos como vista, los mas recientes primero. */
export function prestamos(db: Db, hoy = HOY): LoanView[] {
  return db.prestamos
    .map((loan) => vistaPrestamo(db, loan, hoy))
    .sort((a, b) => b.fechaPrestamo.localeCompare(a.fechaPrestamo));
}

export function prestamosDe(db: Db, userId: string, hoy = HOY): LoanView[] {
  return prestamos(db, hoy).filter((p) => p.userId === userId);
}

/** Prestamos sin devolver cuya fecha limite ya paso. */
export function prestamosVencidos(db: Db, hoy = HOY): LoanView[] {
  return prestamos(db, hoy)
    .filter((p) => !p.fechaDevolucion && p.diasAtraso > 0)
    .sort((a, b) => b.diasAtraso - a.diasAtraso);
}

export function vistaSancion(db: Db, sancion: Penalty): PenaltyView {
  const libro = db.libros.find((l) => l.isbn === sancion.isbn);
  const estudiante = db.usuarios.find((u) => u.id === sancion.userId);

  return {
    ...sancion,
    libro: libro ?? libroDesconocido(sancion.isbn),
    estudiante: estudiante ?? estudianteDesconocido(sancion.userId),
  };
}

function estudianteDesconocido(id: string): User {
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

/** Sanciones como vista, las mas nuevas primero. */
export function sanciones(db: Db): PenaltyView[] {
  return db.sanciones
    .map((s) => vistaSancion(db, s))
    .sort((a, b) => b.id.localeCompare(a.id));
}

export function sancionesDe(db: Db, userId: string): PenaltyView[] {
  return sanciones(db).filter((s) => s.userId === userId);
}

/** true si el estudiante tiene al menos una multa sin pagar. */
export function tieneSancionPendiente(db: Db, userId: string): boolean {
  return db.sanciones.some(
    (s) => s.userId === userId && s.estado === "pendiente",
  );
}

/** Notificaciones del usuario, de la mas reciente a la mas vieja. */
export function notificacionesDe(db: Db, userId: string) {
  return db.notificaciones
    .filter((n) => n.userId === userId)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

export function sinLeer(db: Db, userId: string): number {
  return db.notificaciones.filter((n) => n.userId === userId && !n.leida).length;
}

/* --- Indicadores del panel del bibliotecario ------------------- */

export interface Indicadores {
  titulos: number;
  ejemplares: number;
  disponibles: number;
  prestados: number;
  reservados: number;
  mantenimiento: number;
  vencidos: number;
}

/** Contadores de inventario, opcionalmente acotados a una sede. */
export function indicadores(
  db: Db,
  sede: SedeId | "todas" = "todas",
  hoy = HOY,
): Indicadores {
  const ejemplares = db.ejemplares.filter(
    (e) => e.estado !== "baja" && (sede === "todas" || e.sede === sede),
  );
  const cuenta = (estado: EstadoEjemplar) =>
    ejemplares.filter((e) => e.estado === estado).length;

  const titulos = db.libros.filter(
    (l) => l.activo && ejemplares.some((e) => e.isbn === l.isbn),
  ).length;

  const vencidos = prestamosVencidos(db, hoy).filter(
    (p) => sede === "todas" || p.sede === sede,
  ).length;

  return {
    titulos,
    ejemplares: ejemplares.length,
    disponibles: cuenta("disponible"),
    prestados: cuenta("prestado"),
    reservados: cuenta("reservado"),
    mantenimiento: cuenta("mantenimiento"),
    vencidos,
  };
}

/** Categorias presentes en el catalogo, para los chips de filtro. */
export function categorias(db: Db): string[] {
  return [...new Set(db.libros.filter((l) => l.activo).map((l) => l.categoria))];
}

/* --- Busqueda y filtrado --------------------------------------
   Viven aca y no en lib/api porque son lecturas derivadas: al
   recibir `db` quedan reactivas por construccion, sin depender de
   que el componente llame a useDb() por separado.
   -------------------------------------------------------------- */

export interface FiltroPrestamos {
  /** Busca por ID de prestamo, DNI, legajo, nombre, titulo, ISBN o comprobante. */
  q?: string;
  estado?: "activos" | "vencidos" | "devueltos" | "todos";
  userId?: string;
  sede?: SedeId | "todas";
}

export function filtrarPrestamos(db: Db, filtro: FiltroPrestamos = {}): LoanView[] {
  const { q = "", estado = "todos", userId, sede = "todas" } = filtro;
  const texto = q.trim().toLowerCase();
  const soloDigitos = texto.replace(/\D/g, "");

  let resultado = userId ? prestamosDe(db, userId) : prestamos(db);

  if (sede !== "todas") {
    resultado = resultado.filter((p) => p.sede === sede);
  }

  if (estado === "activos") {
    resultado = resultado.filter((p) => !p.fechaDevolucion);
  } else if (estado === "vencidos") {
    resultado = resultado.filter((p) => !p.fechaDevolucion && p.diasAtraso > 0);
  } else if (estado === "devueltos") {
    resultado = resultado.filter((p) => p.fechaDevolucion !== null);
  }

  if (!texto) return resultado;

  return resultado.filter(
    (p) =>
      p.id.toLowerCase().includes(texto) ||
      p.isbn.includes(texto) ||
      p.copia.toLowerCase().includes(texto) ||
      p.codigoRetiro.toLowerCase().includes(texto) ||
      p.libro.titulo.toLowerCase().includes(texto) ||
      p.estudiante.nombre.toLowerCase().includes(texto) ||
      (soloDigitos.length > 2 &&
        (p.estudiante.legajo.includes(soloDigitos) ||
          p.estudiante.dni.replace(/\D/g, "").includes(soloDigitos))),
  );
}

export interface FiltroSanciones {
  estado?: "todas" | "cobradas" | "pendientes";
  userId?: string;
  q?: string;
}

export function filtrarSanciones(db: Db, filtro: FiltroSanciones = {}): PenaltyView[] {
  const { estado = "todas", userId, q = "" } = filtro;
  const texto = q.trim().toLowerCase();
  const soloDigitos = texto.replace(/\D/g, "");

  let resultado = userId ? sancionesDe(db, userId) : sanciones(db);

  if (estado === "cobradas") {
    resultado = resultado.filter((s) => s.estado === "cobrada");
  } else if (estado === "pendientes") {
    resultado = resultado.filter((s) => s.estado === "pendiente");
  }

  if (!texto) return resultado;

  return resultado.filter(
    (s) =>
      s.id.toLowerCase().includes(texto) ||
      s.loanId.toLowerCase().includes(texto) ||
      s.isbn.includes(texto) ||
      s.libro.titulo.toLowerCase().includes(texto) ||
      s.estudiante.nombre.toLowerCase().includes(texto) ||
      (soloDigitos.length > 2 && s.estudiante.legajo.includes(soloDigitos)),
  );
}

export type FiltroNotificaciones =
  | "todas"
  | "sin_leer"
  | "vencimientos"
  | "sanciones";

export function filtrarNotificaciones(
  db: Db,
  userId: string,
  filtro: FiltroNotificaciones = "todas",
): Notification[] {
  const todas = notificacionesDe(db, userId);

  if (filtro === "sin_leer") return todas.filter((n) => !n.leida);
  if (filtro === "vencimientos") {
    return todas.filter((n) => n.tipo === "vencimiento");
  }
  if (filtro === "sanciones") return todas.filter((n) => n.tipo === "sancion");
  return todas;
}
