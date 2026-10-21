import { LECTORES } from "../datos/seed.js";
import type { Lector } from "../dominio/tipos.js";

export interface EventoSancion {
  eventType: "library.penalty.applied.v1";
  source: "library";
  subject: string; // "user/{userId}"
  data: { userId: string; loanId: string; daysLate: number; amount: string; currency: string };
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

interface LectorDto {
  id: string; name: string; email: string; studentId: string; nationalId: string;
  role: "student" | "librarian"; defaultSiteId: Lector["sedeDefault"]; initials: string; label: string;
}

/** Cliente HTTP del CORE real (rutas /internal/v1, autenticadas con X-Service-Key). */
export class CoreHttp implements PuertoCore {
  constructor(private baseUrl: string, private serviceKey: string) {}

  private async pedir(metodo: "GET" | "POST", ruta: string, correlationId: string, body?: unknown): Promise<unknown> {
    let r: Response;
    try {
      r = await fetch(this.baseUrl + ruta, {
        method: metodo,
        headers: { "x-service-key": this.serviceKey, "x-correlation-id": correlationId, ...(body ? { "content-type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(5000),
      });
    } catch (e) {
      throw new CoreNoDisponible(`CORE no disponible: ${(e as Error).message}`);
    }
    const datos = (await r.json().catch(() => ({}))) as { code?: string };
    if (r.ok) return datos;
    if (r.status >= 500) throw new CoreNoDisponible(`CORE respondio ${r.status}`);
    if (r.status === 409 && datos.code === "INSUFFICIENT_FUNDS") throw new SaldoInsuficiente("Saldo insuficiente");
    throw new Error(`CORE respondio ${r.status} ${datos.code ?? ""} en ${metodo} ${ruta}`);
  }

  private async usuarios(query: string, correlationId: string): Promise<Lector[]> {
    const dtos = (await this.pedir("GET", `/internal/v1/users?${query}`, correlationId)) as LectorDto[];
    return dtos.map((d) => ({
      id: d.id, nombre: d.name, email: d.email, legajo: d.studentId, dni: d.nationalId,
      rol: d.role === "librarian" ? "bibliotecario" : "estudiante",
      sedeDefault: d.defaultSiteId, iniciales: d.initials, etiqueta: d.label,
    }));
  }

  lectores(ids: string[], correlationId: string) {
    return this.usuarios(new URLSearchParams({ ids: ids.join(",") }).toString().replace(/%2C/g, ","), correlationId);
  }

  buscarLectores(q: string, correlationId: string) {
    return this.usuarios(new URLSearchParams({ q }).toString(), correlationId);
  }

  async debitar(userId: string, monto: number, penaltyId: string, correlationId: string) {
    const r = (await this.pedir("POST", `/internal/v1/wallets/${encodeURIComponent(userId)}/debits`, correlationId, {
      amount: monto.toFixed(2), currency: "ARS", concept: "LIBRARY_FINE", sourceModule: "library", externalReference: `penalty/${penaltyId}`,
    })) as { operationId: string };
    return { operacion: r.operationId };
  }

  async publicarEvento(evento: EventoSancion, correlationId: string) {
    await this.pedir("POST", "/internal/v1/events", correlationId, evento);
  }
}
