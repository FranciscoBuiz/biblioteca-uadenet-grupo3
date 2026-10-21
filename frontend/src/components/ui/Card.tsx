import Link from "next/link";
import type { ReactNode } from "react";

/* ---------------------------------------------------------------
   Contenedores de la maqueta: tarjeta blanca con borde #E3E6EA y
   radio de 14px, y la tarjeta de indicador con su label en
   mayusculas y el numero grande en serif.
   --------------------------------------------------------------- */

export function Card({
  children,
  padding = true,
  className = "",
}: {
  children: ReactNode;
  /** false cuando la tarjeta contiene filas o una tabla a sangre. */
  padding?: boolean;
  className?: string;
}) {
  return (
    <div
      className={[
        "overflow-hidden rounded-tarjeta border border-borde bg-white",
        padding ? "p-5" : "",
        className,
      ].join(" ")}
    >
      {children}
    </div>
  );
}

/** Encabezado de tarjeta con titulo y accion opcional a la derecha. */
export function CardHeader({
  titulo,
  accion,
}: {
  titulo: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-borde-suave px-5 py-4">
      <h2 className="text-[15px] font-semibold">{titulo}</h2>
      {accion}
    </div>
  );
}

export type TonoIndicador = "neutro" | "rojo" | "verde" | "azul";

const TONOS: Record<TonoIndicador, string> = {
  neutro: "text-institucional",
  rojo: "text-rojo",
  verde: "text-verde",
  azul: "text-secundario",
};

/** Tarjeta de indicador: label, numero grande y pie descriptivo. */
export function StatCard({
  label,
  valor,
  pie,
  tono = "neutro",
  href,
}: {
  label: string;
  valor: ReactNode;
  pie?: string;
  tono?: TonoIndicador;
  /** Si viene, la tarjeta entera navega. */
  href?: string;
}) {
  const contenido = (
    <>
      <div className="eyebrow">{label}</div>
      <div className={`serif mt-2 text-[30px] leading-none ${TONOS[tono]}`}>
        {valor}
      </div>
      {pie && <div className="mt-1.5 text-xs text-tenue">{pie}</div>}
    </>
  );

  const clases =
    "block rounded-tarjeta border border-borde bg-white p-[18px] transition-colors";

  if (href) {
    return (
      <Link href={href} className={`${clases} hover:border-secundario`}>
        {contenido}
      </Link>
    );
  }

  return <div className={clases}>{contenido}</div>;
}

/** Hero azul del inicio del estudiante: saludo y resumen. */
export function Hero({
  titulo,
  bajada,
  accion,
}: {
  titulo: ReactNode;
  bajada: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <div className="rounded-hero bg-institucional px-7 py-6 text-white sm:px-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          {/* <p> y no <h1>: el unico h1 de la pantalla lo pone <Cabecera>. */}
          <p className="serif text-2xl sm:text-[26px]">{titulo}</p>
          <p className="mt-1.5 max-w-xl text-sm text-sidebar-texto">{bajada}</p>
        </div>
        {accion}
      </div>
    </div>
  );
}

/** Par label/valor de las fichas de detalle, separado por una linea fina. */
export function Dato({
  label,
  children,
  destacado = false,
}: {
  label: string;
  children: ReactNode;
  destacado?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-borde-fino py-2.5 last:border-b-0">
      <dt className="shrink-0 text-[13px] text-apagado">{label}</dt>
      <dd
        className={[
          "min-w-0 text-right text-[13px]",
          destacado ? "font-semibold" : "font-medium",
        ].join(" ")}
      >
        {children}
      </dd>
    </div>
  );
}

/** Lista de pares label/valor. */
export function Datos({ children }: { children: ReactNode }) {
  return <dl className="mt-1">{children}</dl>;
}

export type TonoAviso = "info" | "alerta" | "error" | "ok";

const AVISOS: Record<TonoAviso, string> = {
  info: "border-aviso-borde bg-aviso-bg text-institucional",
  alerta: "border-[#F0DDB8] bg-alerta-bg text-alerta-fg",
  error: "border-[#F2C9C9] bg-error-bg text-error-fg",
  ok: "border-[#C3DFD2] bg-ok-bg text-ok-fg",
};

/** Caja de advertencia o confirmacion, como la del modal de solicitud. */
export function Aviso({
  tono = "info",
  titulo,
  children,
}: {
  tono?: TonoAviso;
  titulo?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`rounded-[11px] border px-3.5 py-3 text-[13px] leading-relaxed ${AVISOS[tono]}`}
      role={tono === "error" ? "alert" : undefined}
    >
      {titulo && <div className="mb-1 font-semibold">{titulo}</div>}
      {children}
    </div>
  );
}
