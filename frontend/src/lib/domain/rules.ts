import type {
  Categoria,
  EstadoPrestamo,
  FechaISO,
  Loan,
  Penalty,
  Sede,
  SedeId,
} from "./types";

/* ---------------------------------------------------------------
   Unica fuente de verdad de las reglas del modulo Biblioteca.
   Los valores salen de la maqueta y del PDF de la Entrega 1:
   prestamo de 14 dias (26/08 -> 09/09), sancion al dia 8 de atraso
   (limite 08/08, deteccion 17/08 = 9 dias) y multa de $2.500.
   --------------------------------------------------------------- */

/** Dias corridos que dura un prestamo desde la solicitud. */
export const DIAS_PRESTAMO = 14;

/** A partir de cuantos dias de atraso se genera la sancion. */
export const DIAS_PARA_SANCION = 8;

/** Dias de tolerancia sobre la fecha limite antes de la sancion. */
export const DIAS_TOLERANCIA = DIAS_PARA_SANCION - 1;

/** Monto de la multa en ARS (LIBRARY_LATE_FEE del Backoffice). */
export const MONTO_MULTA = 2500;

/** Dias que suma cada renovacion. */
export const DIAS_RENOVACION = 3;

/** Cantidad maxima de renovaciones por prestamo. */
export const MAX_RENOVACIONES = 2;

/** Cuando faltan estos dias o menos, el prestamo esta proximo a vencer. */
export const DIAS_PROXIMO_A_VENCER = 3;

/** Fecha de hoy en horario local. */
// shortcut: se calcula al cargar la página, queda viejo si la pestaña cruza la medianoche
export const HOY: FechaISO = aISO(new Date());

/**
 * Categorias del catalogo, en el orden en que se ofrecen en los formularios.
 * El Record obliga a TypeScript a avisar si el dominio agrega una categoria.
 */
const ORDEN_CATEGORIAS: Record<Categoria, true> = {
  "Programación": true,
  Arquitectura: true,
  "Bases de datos": true,
  Sistemas: true,
  UX: true,
  Redes: true,
  Algoritmos: true,
};

export const CATEGORIAS = Object.keys(ORDEN_CATEGORIAS) as Categoria[];

export const SEDES: Sede[] = [
  { id: "monserrat", nombre: "Monserrat", ciudad: "CABA", direccion: "Lima 717" },
  { id: "belgrano", nombre: "Belgrano", ciudad: "CABA" },
  {
    id: "pinamar",
    nombre: "Pinamar",
    ciudad: "Buenos Aires",
    direccion: "Av. Bunge 450",
  },
];

export function buscarSede(id: SedeId): Sede | undefined {
  return SEDES.find((s) => s.id === id);
}

export function nombreSede(id: SedeId): string {
  return SEDES.find((s) => s.id === id)?.nombre ?? id;
}

/* --- Fechas --------------------------------------------------- */

/** Convierte "2026-08-26" en un Date en horario local, sin corrimiento UTC. */
export function parseFecha(iso: FechaISO): Date {
  const [anio, mes, dia] = iso.split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

export function aISO(fecha: Date): FechaISO {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

export function sumarDias(iso: FechaISO, dias: number): FechaISO {
  const fecha = parseFecha(iso);
  fecha.setDate(fecha.getDate() + dias);
  return aISO(fecha);
}

/** Dias calendario entre dos fechas (positivo si `hasta` es posterior). */
export function diasEntre(desde: FechaISO, hasta: FechaISO): number {
  const MS_DIA = 86_400_000;
  return Math.round((parseFecha(hasta).getTime() - parseFecha(desde).getTime()) / MS_DIA);
}

/** Formatea para pantalla: "2026-08-26" -> "26/08/2026". */
export function formatFecha(iso: FechaISO): string {
  const [anio, mes, dia] = iso.split("-");
  return `${dia}/${mes}/${anio}`;
}

/** Formatea importes: 2500 -> "$2.500". */
export function formatMonto(monto: number): string {
  return `$${monto.toLocaleString("es-AR")}`;
}

/* --- Estados de prestamo -------------------------------------- */

/** Fecha limite de un prestamo solicitado en `fechaPrestamo`. */
export function calcularFechaLimite(fechaPrestamo: FechaISO): FechaISO {
  return sumarDias(fechaPrestamo, DIAS_PRESTAMO);
}

/** Dias que faltan para la fecha limite. Negativo si ya vencio. */
export function diasRestantes(loan: Loan, hoy: FechaISO = HOY): number {
  return diasEntre(hoy, loan.fechaLimite);
}

/** Dias de atraso sobre la fecha limite. 0 si todavia esta en plazo. */
export function diasAtraso(loan: Loan, hoy: FechaISO = HOY): number {
  const referencia = loan.fechaDevolucion ?? hoy;
  return Math.max(0, diasEntre(loan.fechaLimite, referencia));
}

/** true cuando el atraso ya alcanza el umbral de sancion. */
export function correspondeSancion(loan: Loan, hoy: FechaISO = HOY): boolean {
  return diasAtraso(loan, hoy) >= DIAS_PARA_SANCION;
}

/**
 * Estado visible del prestamo. `sancionado` gana sobre `vencido` porque es
 * la situacion mas grave y es la que la maqueta muestra en la tabla.
 */
export function estadoPrestamo(
  loan: Loan,
  sancion: Penalty | null,
  hoy: FechaISO = HOY,
): EstadoPrestamo {
  if (loan.fechaDevolucion) return "devuelto";
  if (sancion) return "sancionado";
  const restantes = diasRestantes(loan, hoy);
  if (restantes < 0) return "vencido";
  if (restantes <= DIAS_PROXIMO_A_VENCER) return "proximo_a_vencer";
  return "en_curso";
}

/** Pluraliza una cantidad de dias: 1 -> "1 día", 3 -> "3 días". */
export function enDias(cantidad: number): string {
  return `${cantidad} ${Math.abs(cantidad) === 1 ? "día" : "días"}`;
}

/**
 * Segunda linea de la pill de estado, tal como la escribe la maqueta:
 * "2 dias restantes", "3 dias de atraso" o "Devuelto 29/07/2026".
 */
export function detalleEstadoPrestamo(
  loan: Pick<Loan, "fechaDevolucion" | "fechaLimite">,
  hoy: FechaISO = HOY,
): string {
  if (loan.fechaDevolucion) {
    return `Devuelto ${formatFecha(loan.fechaDevolucion)}`;
  }
  const restantes = diasEntre(hoy, loan.fechaLimite);
  if (restantes < 0) return `${enDias(-restantes)} de atraso`;
  return `${enDias(restantes)} restantes`;
}

export const ETIQUETA_ESTADO: Record<EstadoPrestamo, string> = {
  en_curso: "En curso",
  proximo_a_vencer: "Próximo a vencer",
  vencido: "Vencido",
  sancionado: "Sancionado",
  devuelto: "Devuelto",
};

/* --- Renovacion ----------------------------------------------- */

export interface ResultadoRenovacion {
  puede: boolean;
  motivo: string;
}

/** Evalua si un prestamo admite una renovacion mas y por que. */
export function puedeRenovar(
  loan: Loan,
  sancion: Penalty | null,
  hoy: FechaISO = HOY,
): ResultadoRenovacion {
  if (loan.fechaDevolucion) {
    return { puede: false, motivo: "El préstamo ya fue devuelto." };
  }
  if (sancion && sancion.estado === "pendiente") {
    return { puede: false, motivo: "Tenés una sanción pendiente de pago sobre este préstamo." };
  }
  if (loan.renovaciones >= MAX_RENOVACIONES) {
    return {
      puede: false,
      motivo: `Ya usaste las ${MAX_RENOVACIONES} renovaciones disponibles.`,
    };
  }
  if (loan.tieneReservas) {
    return { puede: false, motivo: "Hay reservas pendientes sobre este título." };
  }
  if (diasRestantes(loan, hoy) < 0) {
    return { puede: false, motivo: "El préstamo está vencido, no se puede renovar." };
  }
  return {
    puede: true,
    motivo: `No hay reservas pendientes sobre este título, podés extender la devolución ${DIAS_RENOVACION} días.`,
  };
}

/* --- Validaciones de formulario ------------------------------- */

/** El ISBN del alta de libro debe tener entre 10 y 13 digitos. */
export function validarIsbn(valor: string): string | null {
  const limpio = valor.replace(/[\s-]/g, "");
  if (!limpio) return "El ISBN es obligatorio.";
  if (!/^\d+$/.test(limpio)) return "El ISBN solo puede contener números.";
  if (limpio.length < 10 || limpio.length > 13) {
    return "El ISBN debe tener entre 10 y 13 dígitos.";
  }
  return null;
}

export function validarObligatorio(valor: string, campo: string): string | null {
  return valor.trim() ? null : `${campo} es obligatorio.`;
}

export function validarAnio(valor: string): string | null {
  if (!valor.trim()) return "El año es obligatorio.";
  const anio = Number(valor);
  if (!Number.isInteger(anio)) return "El año debe ser un número entero.";
  if (anio < 1450 || anio > parseFecha(HOY).getFullYear() + 1) {
    return "Ingresá un año de edición válido.";
  }
  return null;
}

export function validarCantidad(valor: string): string | null {
  if (!valor.trim()) return "La cantidad es obligatoria.";
  const cantidad = Number(valor);
  if (!Number.isInteger(cantidad) || cantidad < 1) {
    return "La cantidad debe ser un número entero mayor a cero.";
  }
  if (cantidad > 50) return "No se pueden ingresar más de 50 ejemplares por vez.";
  return null;
}

/* --- Generadores de identificadores --------------------------- */

export function nuevoCodigoRetiro(): string {
  return `RET-${Math.floor(100_000 + Math.random() * 900_000)}`;
}

export function nuevaOperacion(): string {
  return `OP-${Math.floor(10_000_000 + Math.random() * 90_000_000)}`;
}
