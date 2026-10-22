import type { Activity, Loan, LoanView, Penalty, SedeId } from "@/lib/domain/types";
import {
  aActividad,
  aPrestamo,
  aSancion,
  aVistaPrestamo,
  type ActivityDto,
  type LoanDto,
  type LoanDtoSimple,
  type PenaltyDtoSimple,
} from "./adaptadores";
import { consulta, pedir } from "./http";

/* ---------------------------------------------------------------
   GET  /api/v1/library/loans
   POST /api/v1/library/loans
   POST /api/v1/library/loans/{id}/renew
   POST /api/v1/library/loans/{id}/return
   El backend filtra por el token: el estudiante ve solo lo propio.
   --------------------------------------------------------------- */

export interface FiltroPrestamos {
  /** Busca por ID de prestamo, DNI, legajo, nombre, titulo, ISBN o comprobante. */
  q?: string;
  estado?: "activos" | "vencidos" | "devueltos" | "todos";
  sede?: SedeId | "todas";
}

const ESTADO = { activos: "active", vencidos: "overdue", devueltos: "returned", todos: "all" } as const;

export async function getLoans(
  filtro: FiltroPrestamos = {},
): Promise<LoanView[]> {
  const { q, estado, sede } = filtro;
  const lista = await pedir<LoanDto[]>(
    "GET",
    `/loans${consulta({
      q: q?.trim(),
      status: estado && ESTADO[estado],
      siteId: sede === "todas" ? undefined : sede,
    })}`,
  );
  return lista.map(aVistaPrestamo);
}

export async function getLoan(id: string): Promise<LoanView> {
  return aVistaPrestamo(await pedir<LoanDto>("GET", `/loans/${encodeURIComponent(id)}`));
}

export async function getOverdueLoans(): Promise<LoanView[]> {
  return getLoans({ estado: "vencidos" });
}

/** Actividad reciente del panel del bibliotecario. */
export async function getActividad(): Promise<Activity[]> {
  return (await pedir<ActivityDto[]>("GET", "/activities")).map(aActividad);
}

/**
 * Genera un prestamo: el backend reserva el primer ejemplar disponible en la
 * sede, calcula la fecha limite y emite el codigo de retiro. El usuario sale del token.
 */
export async function createLoan(isbn: string, sede: SedeId): Promise<Loan> {
  return aPrestamo(await pedir<LoanDtoSimple>("POST", "/loans", { isbn, siteId: sede }));
}

/** Extiende la fecha limite si el prestamo admite renovacion. */
export async function renewLoan(id: string): Promise<Loan> {
  return aPrestamo(await pedir<LoanDtoSimple>("POST", `/loans/${encodeURIComponent(id)}/renew`));
}

export interface ResultadoDevolucion {
  prestamo: Loan;
  /** Sancion recien generada, o null si la devolucion entro en plazo. */
  sancion: Penalty | null;
}

/** Cierra el prestamo en el mostrador; el backend genera la sancion si corresponde. */
export async function returnLoan(id: string): Promise<ResultadoDevolucion> {
  const r = await pedir<{ loan: LoanDtoSimple; penalty: PenaltyDtoSimple | null }>(
    "POST",
    `/loans/${encodeURIComponent(id)}/return`,
  );
  return { prestamo: aPrestamo(r.loan), sancion: r.penalty ? aSancion(r.penalty) : null };
}
