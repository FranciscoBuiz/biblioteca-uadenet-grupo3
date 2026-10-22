import { aISO } from "@/lib/domain/rules";
import type {
  Activity,
  Book,
  BookWithStock,
  Categoria,
  Copy,
  EstadoEjemplar,
  EstadoPrestamo,
  FechaISO,
  Loan,
  LoanView,
  Notification,
  PaymentReceipt,
  Penalty,
  PenaltyView,
  SedeId,
  TipoActividad,
  TipoNotificacion,
  User,
} from "@/lib/domain/types";

/* ---------------------------------------------------------------
   JSON del contrato (library/openapi.yaml) -> modelo de las pantallas.
   Los tipos DTO se copian aca: el contrato es el JSON, no el codigo.
   Fechas: segundos Unix a medianoche local -> "AAAA-MM-DD".
   --------------------------------------------------------------- */

export interface BookDto {
  isbn: string; title: string; author: string; publisher: string; year: number;
  category: string; description: string; active: boolean;
}
export interface BookWithStockDto extends BookDto {
  stock: { total: number; available: number; loaned: number; bySite: Record<SedeId, number> };
}
export interface CopyDto { code: string; isbn: string; siteId: SedeId; status: string }
export interface LectorDto {
  id: string; name: string; email: string; studentId: string; nationalId: string;
  role: "student" | "librarian"; defaultSiteId: SedeId; initials: string; label: string;
}
export interface PenaltyDtoSimple {
  id: string; loanId: string; userId: string; isbn: string; amount: number; currency: string;
  daysLate: number; originalDueAt: number; detectedAt: number; paidAt: number | null; status: string;
}
export interface PenaltyDto extends PenaltyDtoSimple { book: BookDto; student: LectorDto }
export interface LoanDtoSimple {
  id: string; isbn: string; copyCode: string; userId: string; siteId: SedeId;
  loanedAt: number; dueAt: number; returnedAt: number | null; renewals: number;
  pickupCode: string; hasReservations: boolean;
}
export interface LoanDto extends LoanDtoSimple {
  status: string; daysLeft: number; daysLate: number;
  book: BookDto; student: LectorDto; penalty: PenaltyDtoSimple | null;
}
export interface NotificationDto {
  id: string; type: string; title: string; body: string; createdAt: number; read: boolean;
}
export interface ActivityDto { id: string; type: string; text: string; createdAt: number }
export interface ReceiptDto {
  operationId: string; penaltyId: string; amount: number; currency: string; method: string; paidAt: number;
}
export interface IndicatorsDto {
  titles: number; copies: number; available: number; loaned: number;
  reserved: number; maintenance: number; overdue: number;
}

const aFecha = (segundos: number): FechaISO => aISO(new Date(segundos * 1000));
const aFechaONull = (s: number | null) => (s === null ? null : aFecha(s));
const dos = (n: number) => String(n).padStart(2, "0");

const inverso = <T extends string>(tabla: Record<string, T>, valor: string, defecto: T): T =>
  tabla[valor] ?? defecto;

export const aUsuario = (d: LectorDto): User => ({
  id: d.id,
  nombre: d.name,
  email: d.email,
  legajo: d.studentId,
  dni: d.nationalId,
  rol: d.role === "librarian" ? "bibliotecario" : "estudiante",
  sedeDefault: d.defaultSiteId,
  iniciales: d.initials,
  etiqueta: d.label,
});

export const aLibro = (d: BookDto): Book => ({
  isbn: d.isbn,
  titulo: d.title,
  autor: d.author,
  editorial: d.publisher,
  anio: d.year,
  categoria: d.category as Categoria,
  descripcion: d.description,
  activo: d.active,
});

export const aLibroConStock = (d: BookWithStockDto): BookWithStock => ({
  ...aLibro(d),
  totales: d.stock.total,
  disponibles: d.stock.available,
  prestados: d.stock.loaned,
  porSede: d.stock.bySite,
});

export const aEjemplar = (d: CopyDto): Copy => ({
  codigo: d.code,
  isbn: d.isbn,
  sede: d.siteId,
  estado: inverso<EstadoEjemplar>(
    { available: "disponible", loaned: "prestado", reserved: "reservado", maintenance: "mantenimiento", retired: "baja" },
    d.status,
    "baja",
  ),
});

export const aSancion = (d: PenaltyDtoSimple): Penalty => ({
  id: d.id,
  loanId: d.loanId,
  userId: d.userId,
  isbn: d.isbn,
  monto: d.amount,
  diasAtraso: d.daysLate,
  fechaLimiteOriginal: aFecha(d.originalDueAt),
  fechaDeteccion: aFecha(d.detectedAt),
  fechaCobro: aFechaONull(d.paidAt),
  estado: d.status === "paid" ? "cobrada" : "pendiente",
});

export const aVistaSancion = (d: PenaltyDto): PenaltyView => ({
  ...aSancion(d),
  libro: aLibro(d.book),
  estudiante: aUsuario(d.student),
});

export const aPrestamo = (d: LoanDtoSimple): Loan => ({
  id: d.id,
  isbn: d.isbn,
  copia: d.copyCode,
  userId: d.userId,
  sede: d.siteId,
  fechaPrestamo: aFecha(d.loanedAt),
  fechaLimite: aFecha(d.dueAt),
  fechaDevolucion: aFechaONull(d.returnedAt),
  renovaciones: d.renewals,
  codigoRetiro: d.pickupCode,
  tieneReservas: d.hasReservations,
});

export const aVistaPrestamo = (d: LoanDto): LoanView => ({
  ...aPrestamo(d),
  libro: aLibro(d.book),
  estudiante: aUsuario(d.student),
  estado: inverso<EstadoPrestamo>(
    { active: "en_curso", dueSoon: "proximo_a_vencer", overdue: "vencido", penalized: "sancionado", returned: "devuelto" },
    d.status,
    "en_curso",
  ),
  diasRestantes: d.daysLeft,
  diasAtraso: d.daysLate,
  sancion: d.penalty ? aSancion(d.penalty) : null,
});

export const aNotificacion = (d: NotificationDto, userId: string): Notification => ({
  id: d.id,
  userId,
  tipo: inverso<TipoNotificacion>(
    { penalty: "sancion", dueDate: "vencimiento", receipt: "comprobante" },
    d.type,
    "comprobante",
  ),
  titulo: d.title,
  cuerpo: d.body,
  fecha: aFecha(d.createdAt),
  leida: d.read,
});

export const aActividad = (d: ActivityDto): Activity => {
  const f = new Date(d.createdAt * 1000);
  return {
    id: d.id,
    tipo: inverso<TipoActividad>(
      { return: "devolucion", loan: "prestamo", penalty: "sancion", copyAdded: "alta_ejemplar" },
      d.type,
      "prestamo",
    ),
    texto: d.text,
    fecha: aISO(f),
    hora: `${dos(f.getHours())}:${dos(f.getMinutes())}`,
  };
};

export const aComprobante = (d: ReceiptDto): PaymentReceipt => ({
  operacion: d.operationId,
  penaltyId: d.penaltyId,
  monto: d.amount,
  metodo: "saldo",
  fecha: aFecha(d.paidAt),
});

export const aIndicadores = (d: IndicatorsDto) => ({
  titulos: d.titles,
  ejemplares: d.copies,
  disponibles: d.available,
  prestados: d.loaned,
  reservados: d.reserved,
  mantenimiento: d.maintenance,
  vencidos: d.overdue,
});

export type Indicadores = ReturnType<typeof aIndicadores>;
