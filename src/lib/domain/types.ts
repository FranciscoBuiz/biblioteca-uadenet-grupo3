/* ---------------------------------------------------------------
   Modelo de dominio del modulo Biblioteca.
   Las formas replican los contratos del CORE Gateway documentados
   en UADEnet_Biblioteca_Grupo3.xlsx para que el dia que exista el
   backend real solo haya que cambiar el cuerpo de lib/api/*.
   --------------------------------------------------------------- */

/** Fecha en formato ISO corto: "2026-08-26". */
export type FechaISO = string;

export type SedeId = "monserrat" | "belgrano" | "pinamar";

export interface Sede {
  id: SedeId;
  nombre: string;
  ciudad: string;
  /** Domicilio de la sede. Opcional: la maqueta solo trae el de dos de las tres. */
  direccion?: string;
}

export type Rol = "estudiante" | "bibliotecario";

export interface User {
  id: string;
  nombre: string;
  email: string;
  legajo: string;
  dni: string;
  rol: Rol;
  sedeDefault: SedeId;
  /** Iniciales para el avatar del sidebar, ej. "AG". */
  iniciales: string;
  /** Etiqueta que se muestra bajo el nombre, ej. "Estudiante". */
  etiqueta: string;
}

export type Categoria =
  | "Programación"
  | "Arquitectura"
  | "Bases de datos"
  | "Sistemas"
  | "UX"
  | "Redes"
  | "Algoritmos";

export interface Book {
  isbn: string;
  titulo: string;
  autor: string;
  editorial: string;
  anio: number;
  categoria: Categoria;
  descripcion: string;
  /** false cuando el titulo fue dado de baja del catalogo (se puede reactivar). */
  activo: boolean;
}

export type EstadoEjemplar =
  | "disponible"
  | "prestado"
  | "reservado"
  | "mantenimiento"
  | "baja";

export interface Copy {
  /** Codigo de inventario, ej. "BA-014". */
  codigo: string;
  isbn: string;
  sede: SedeId;
  estado: EstadoEjemplar;
}

export type EstadoPrestamo =
  | "en_curso"
  | "proximo_a_vencer"
  | "vencido"
  | "sancionado"
  | "devuelto";

export interface Loan {
  /** Ej. "PRE-1003". */
  id: string;
  isbn: string;
  /** Codigo del ejemplar asignado. */
  copia: string;
  userId: string;
  sede: SedeId;
  fechaPrestamo: FechaISO;
  fechaLimite: FechaISO;
  fechaDevolucion: FechaISO | null;
  renovaciones: number;
  /** Codigo que el estudiante presenta en el mostrador, ej. "RET-482910". */
  codigoRetiro: string;
  /** true cuando hay reservas sobre el titulo y no se puede renovar. */
  tieneReservas: boolean;
}

export type EstadoSancion = "pendiente" | "cobrada";

export interface Penalty {
  /** Ej. "SAN-00031". */
  id: string;
  loanId: string;
  userId: string;
  isbn: string;
  monto: number;
  diasAtraso: number;
  fechaLimiteOriginal: FechaISO;
  fechaDeteccion: FechaISO;
  fechaCobro: FechaISO | null;
  estado: EstadoSancion;
}

export type TipoNotificacion = "sancion" | "vencimiento" | "comprobante";

export interface Notification {
  id: string;
  userId: string;
  tipo: TipoNotificacion;
  titulo: string;
  cuerpo: string;
  fecha: FechaISO;
  leida: boolean;
}

export type TipoActividad =
  | "devolucion"
  | "prestamo"
  | "sancion"
  | "alta_ejemplar";

/** Feed de actividad reciente del panel del bibliotecario. */
export interface Activity {
  id: string;
  tipo: TipoActividad;
  texto: string;
  fecha: FechaISO;
  hora: string;
}

export type MetodoPago = "saldo" | "tarjeta" | "transferencia";

export interface PaymentReceipt {
  /** Nro. de operacion, ej. "OP-77301148". */
  operacion: string;
  penaltyId: string;
  monto: number;
  metodo: MetodoPago;
  fecha: FechaISO;
}

/* --- Tipos derivados que consumen las vistas --- */

/** Libro con sus contadores de ejemplares ya calculados. */
export interface BookWithStock extends Book {
  totales: number;
  disponibles: number;
  prestados: number;
  /** Ejemplares disponibles por sede. */
  porSede: Record<SedeId, number>;
}

/** Prestamo enriquecido con libro, estudiante, estado calculado y dias. */
export interface LoanView extends Loan {
  libro: Book;
  estudiante: User;
  estado: EstadoPrestamo;
  diasRestantes: number;
  diasAtraso: number;
  sancion: Penalty | null;
}

/** Sancion enriquecida con libro y estudiante. */
export interface PenaltyView extends Penalty {
  libro: Book;
  estudiante: User;
}
