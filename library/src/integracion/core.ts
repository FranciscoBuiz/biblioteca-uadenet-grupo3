import { LECTORES } from "../datos/seed.js";
import type { Lector } from "../dominio/tipos.js";

export interface EventoSancion {
  eventType: "library.penalty.applied.v1";
  source: "library";
  subject: string; // "user/{userId}"
  data: { userId: string; loanId: string; daysLate: number; amount: number; currency: string };
}

export interface PuertoCore {
  lectores(ids: string[], correlationId: string): Promise<Lector[]>;
  buscarLectores(q: string, correlationId: string): Promise<Lector[]>;
  debitar(userId: string, monto: number, penaltyId: string, correlationId: string): Promise<{ operacion: string }>;
  publicarEvento(evento: EventoSancion, correlationId: string): Promise<void>;
}

export class SaldoInsuficiente extends Error {}
export class CoreNoDisponible extends Error {}

/** Doble de prueba del CORE: en memoria, con saldos, eventos y un interruptor de caida. */
export class CoreFalso implements PuertoCore {
  saldos = new Map<string, number>();
  eventos: EventoSancion[] = [];
  /** externalReference ya debitados (idempotencia). */
  debitos: string[] = [];
  caido = false;
  private operaciones = new Map<string, string>();

  private verificar(): void {
    if (this.caido) throw new CoreNoDisponible("CORE no disponible");
  }

  async lectores(ids: string[], _correlationId?: string): Promise<Lector[]> {
    this.verificar();
    return LECTORES.filter((l) => ids.includes(l.id));
  }

  async buscarLectores(q: string, _correlationId?: string): Promise<Lector[]> {
    this.verificar();
    const t = q.trim().toLowerCase();
    return LECTORES.filter((l) => [l.nombre, l.email, l.legajo, l.dni].some((c) => c.toLowerCase().includes(t)));
  }

  async debitar(userId: string, monto: number, penaltyId: string, _correlationId?: string): Promise<{ operacion: string }> {
    this.verificar();
    const ref = `penalty/${penaltyId}`;
    const previa = this.operaciones.get(ref);
    if (previa) return { operacion: previa };
    const saldo = this.saldos.get(userId) ?? 0;
    if (saldo < monto) throw new SaldoInsuficiente("Saldo insuficiente");
    this.saldos.set(userId, saldo - monto);
    const operacion = `OP-${this.debitos.length + 1}`;
    this.debitos.push(ref);
    this.operaciones.set(ref, operacion);
    return { operacion };
  }

  async publicarEvento(evento: EventoSancion, _correlationId?: string): Promise<void> {
    this.verificar();
    this.eventos.push(evento);
  }
}
