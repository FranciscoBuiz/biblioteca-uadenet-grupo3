import { ETIQUETA_ESTADO } from "@/lib/domain/rules";
import type {
  EstadoEjemplar,
  EstadoPrestamo,
  EstadoSancion,
} from "@/lib/domain/types";

/* ---------------------------------------------------------------
   Pills de estado. Los pares fondo/texto son los de la maqueta:
   ambar #FDF3E2/#8A5A11, verde #E8F1EC/#0E5C43, rojo
   #FDECEC/#9F2020 y gris #EEF1F5/#5B6673.
   --------------------------------------------------------------- */

export type TonoPill = "ambar" | "verde" | "rojo" | "gris" | "azul";

const TONOS: Record<TonoPill, string> = {
  ambar: "bg-alerta-bg text-alerta-fg",
  verde: "bg-ok-bg text-ok-fg",
  rojo: "bg-error-bg text-error-fg",
  gris: "bg-neutro-bg text-tenue",
  azul: "bg-aviso-bg text-secundario",
};

export function Pill({
  tono = "gris",
  children,
}: {
  tono?: TonoPill;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${TONOS[tono]}`}
    >
      {children}
    </span>
  );
}

const TONO_PRESTAMO: Record<EstadoPrestamo, TonoPill> = {
  en_curso: "verde",
  proximo_a_vencer: "ambar",
  vencido: "rojo",
  sancionado: "rojo",
  devuelto: "gris",
};

/**
 * Pill del estado de un prestamo. `detalle` es la segunda linea que la
 * maqueta muestra debajo ("2 dias restantes", "3 dias de atraso").
 */
export function EstadoPrestamoPill({
  estado,
  detalle,
}: {
  estado: EstadoPrestamo;
  detalle?: string;
}) {
  return (
    <div className="inline-flex flex-col items-start gap-1">
      <Pill tono={TONO_PRESTAMO[estado]}>{ETIQUETA_ESTADO[estado]}</Pill>
      {detalle && <span className="text-[11px] text-apagado">{detalle}</span>}
    </div>
  );
}

const EJEMPLAR: Record<EstadoEjemplar, { tono: TonoPill; etiqueta: string }> = {
  disponible: { tono: "verde", etiqueta: "Disponible" },
  prestado: { tono: "ambar", etiqueta: "Prestado" },
  reservado: { tono: "azul", etiqueta: "Reservado" },
  mantenimiento: { tono: "gris", etiqueta: "En mantenimiento" },
  baja: { tono: "rojo", etiqueta: "Dado de baja" },
};

export function EstadoEjemplarPill({ estado }: { estado: EstadoEjemplar }) {
  const { tono, etiqueta } = EJEMPLAR[estado];
  return <Pill tono={tono}>{etiqueta}</Pill>;
}

export function EstadoSancionPill({ estado }: { estado: EstadoSancion }) {
  return (
    <Pill tono={estado === "cobrada" ? "verde" : "rojo"}>
      {estado === "cobrada" ? "Cobrada" : "Pendiente"}
    </Pill>
  );
}

/** Etiqueta de categoria del catalogo. */
export function CategoriaPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-[#F1F3F6] px-2.5 py-1 text-[11px] font-semibold text-tenue">
      {children}
    </span>
  );
}

/** Texto de disponibilidad: "2 disponibles" o "Sin stock". */
export function Disponibilidad({ cantidad }: { cantidad: number }) {
  if (cantidad === 0) {
    return <span className="text-xs font-semibold text-rojo">Sin stock</span>;
  }
  return (
    <span className="text-xs font-semibold text-verde">
      {cantidad} {cantidad === 1 ? "disponible" : "disponibles"}
    </span>
  );
}
