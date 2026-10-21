/* Dominio -> JSON del contrato publico. Fechas: segundos Unix (medianoche local). */
import { parseFecha } from "../dominio/reglas.js";
import type {
  Activity, Book, BookWithStock, Copy, FechaISO, Lector, Loan, LoanView, Location, Notification,
  PaymentReceipt, Penalty, PenaltyView, Sede,
} from "../dominio/tipos.js";

export const segundos = (iso: FechaISO): number => Math.floor(parseFecha(iso).getTime() / 1000);
const segundosONull = (iso: FechaISO | null) => (iso ? segundos(iso) : null);

function mapa(tabla: Record<string, string>, valor: string): string {
  return tabla[valor] ?? valor;
}

export const bookDto = (b: Book) => ({
  isbn: b.isbn, title: b.titulo, author: b.autor, publisher: b.editorial, year: b.anio,
  category: b.categoria, description: b.descripcion, active: b.activo,
});

export const bookConStockDto = (b: BookWithStock) => ({
  ...bookDto(b),
  stock: { total: b.totales, available: b.disponibles, loaned: b.prestados, bySite: b.porSede },
});

export const copyDto = (c: Copy) => ({
  code: c.codigo, isbn: c.isbn, siteId: c.sede,
  status: mapa({ disponible: "available", prestado: "loaned", reservado: "reserved", mantenimiento: "maintenance", baja: "retired" }, c.estado),
});

export const lectorDto = (l: Lector) => ({
  id: l.id, name: l.nombre, email: l.email, studentId: l.legajo, nationalId: l.dni,
  role: l.rol === "bibliotecario" ? "librarian" : "student",
  defaultSiteId: l.sedeDefault, initials: l.iniciales, label: l.etiqueta,
});

export const siteDto = (s: Sede) => ({ id: s.id, name: s.nombre, city: s.ciudad, address: s.direccion ?? null });

export const locationDto = (l: Location) => ({
  locationId: l.locationId, siteId: l.siteId, name: l.name, capacity: l.capacity, status: l.status,
});

export const penaltySimpleDto = (p: Penalty) => ({
  id: p.id, loanId: p.loanId, userId: p.userId, isbn: p.isbn, amount: p.monto, currency: "ARS" as const,
  daysLate: p.diasAtraso, originalDueAt: segundos(p.fechaLimiteOriginal), detectedAt: segundos(p.fechaDeteccion),
  paidAt: segundosONull(p.fechaCobro), status: p.estado === "cobrada" ? "paid" : "pending",
});

export const penaltyDto = (p: PenaltyView) => ({
  ...penaltySimpleDto(p), book: bookDto(p.libro), student: lectorDto(p.estudiante),
});

/** Prestamo sin enriquecer (alta, renovacion, devolucion). */
export const loanSimpleDto = (l: Loan) => ({
  id: l.id, isbn: l.isbn, copyCode: l.copia, userId: l.userId, siteId: l.sede,
  loanedAt: segundos(l.fechaPrestamo), dueAt: segundos(l.fechaLimite), returnedAt: segundosONull(l.fechaDevolucion),
  renewals: l.renovaciones, pickupCode: l.codigoRetiro, hasReservations: l.tieneReservas,
});

export const loanDto = (l: LoanView) => ({
  ...loanSimpleDto(l),
  status: mapa({ en_curso: "active", proximo_a_vencer: "dueSoon", vencido: "overdue", sancionado: "penalized", devuelto: "returned" }, l.estado),
  daysLeft: l.diasRestantes, daysLate: l.diasAtraso,
  book: bookDto(l.libro), student: lectorDto(l.estudiante),
  penalty: l.sancion ? penaltySimpleDto(l.sancion) : null,
});

export const notificationDto = (n: Notification) => ({
  id: n.id, type: mapa({ sancion: "penalty", vencimiento: "dueDate", comprobante: "receipt" }, n.tipo),
  title: n.titulo, body: n.cuerpo, createdAt: segundos(n.fecha), read: n.leida,
});

export const activityDto = (a: Activity) => {
  const [h, m] = a.hora.split(":").map(Number);
  const f = parseFecha(a.fecha);
  f.setHours(h || 0, m || 0);
  return {
    id: a.id,
    type: mapa({ devolucion: "return", prestamo: "loan", sancion: "penalty", alta_ejemplar: "copyAdded" }, a.tipo),
    text: a.texto, createdAt: Math.floor(f.getTime() / 1000),
  };
};

export const receiptDto = (r: PaymentReceipt) => ({
  operationId: r.operacion, penaltyId: r.penaltyId, amount: r.monto, currency: "ARS",
  method: "institutionalBalance" as const, paidAt: segundos(r.fecha),
});

export const indicatorsDto = (i: import("../servicios/panel.js").Indicadores) => ({
  titles: i.titulos, copies: i.ejemplares, available: i.disponibles, loaned: i.prestados,
  reserved: i.reservados, maintenance: i.mantenimiento, overdue: i.vencidos,
});
