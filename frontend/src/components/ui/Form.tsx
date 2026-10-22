"use client";

import { useId, type ComponentProps, type ReactNode } from "react";

/* ---------------------------------------------------------------
   Campos de formulario (pantallas 10, 16, 17, 18).

   El estado de error replica el caso en vivo del mockup 16: borde
   rojo y el mensaje "El ISBN debe tener entre 10 y 13 dígitos".
   --------------------------------------------------------------- */

const BASE_CONTROL =
  "w-full rounded-[10px] border bg-white px-3.5 py-2.5 text-sm text-institucional " +
  "outline-none transition-colors placeholder:text-apagado " +
  "disabled:cursor-not-allowed disabled:bg-[#F4F6F8] disabled:text-tenue";

function clasesControl(error?: string | null): string {
  return [
    BASE_CONTROL,
    error
      ? "border-rojo focus:border-rojo"
      : "border-borde-fuerte focus:border-secundario",
  ].join(" ");
}

interface BaseCampo {
  label: string;
  error?: string | null;
  /** Texto de ayuda bajo el campo, cuando no hay error. */
  ayuda?: string;
  obligatorio?: boolean;
}

function Envoltura({
  label,
  error,
  ayuda,
  obligatorio,
  id,
  children,
}: BaseCampo & { id: string; children: ReactNode }) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-xs font-semibold text-grafito"
      >
        {label}
        {obligatorio && (
          <span className="ml-0.5 text-rojo" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs text-rojo">
          {error}
        </p>
      ) : (
        ayuda && <p className="mt-1.5 text-xs text-apagado">{ayuda}</p>
      )}
    </div>
  );
}

type PropsInput = BaseCampo &
  Omit<ComponentProps<"input">, "className" | "id">;

export function Campo({
  label,
  error,
  ayuda,
  obligatorio,
  ...resto
}: PropsInput) {
  const id = useId();
  return (
    <Envoltura
      id={id}
      label={label}
      error={error}
      ayuda={ayuda}
      obligatorio={obligatorio}
    >
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-required={obligatorio || undefined}
        className={clasesControl(error)}
        {...resto}
      />
    </Envoltura>
  );
}

type PropsTextarea = BaseCampo &
  Omit<ComponentProps<"textarea">, "className" | "id">;

export function CampoTexto({
  label,
  error,
  ayuda,
  obligatorio,
  rows = 4,
  ...resto
}: PropsTextarea) {
  const id = useId();
  return (
    <Envoltura
      id={id}
      label={label}
      error={error}
      ayuda={ayuda}
      obligatorio={obligatorio}
    >
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-required={obligatorio || undefined}
        className={`${clasesControl(error)} resize-y`}
        {...resto}
      />
    </Envoltura>
  );
}

type PropsSelect = BaseCampo &
  Omit<ComponentProps<"select">, "className" | "id"> & {
    opciones: { valor: string; etiqueta: string }[];
  };

export function CampoSelect({
  label,
  error,
  ayuda,
  obligatorio,
  opciones,
  ...resto
}: PropsSelect) {
  const id = useId();
  return (
    <Envoltura
      id={id}
      label={label}
      error={error}
      ayuda={ayuda}
      obligatorio={obligatorio}
    >
      <select
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        aria-required={obligatorio || undefined}
        className={`${clasesControl(error)} cursor-pointer`}
        {...resto}
      >
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
    </Envoltura>
  );
}

/** Opcion de radio con el aspecto de tarjeta del selector de medio de pago. */
export function OpcionRadio({
  nombre,
  valor,
  seleccionado,
  onChange,
  titulo,
  detalle,
}: {
  nombre: string;
  valor: string;
  seleccionado: boolean;
  onChange: (valor: string) => void;
  titulo: string;
  detalle: string;
}) {
  return (
    <label
      className={[
        "flex cursor-pointer items-start gap-3 rounded-[11px] border px-4 py-3.5 transition-colors",
        seleccionado
          ? "border-secundario bg-aviso-bg"
          : "border-borde-fuerte bg-white hover:border-secundario",
      ].join(" ")}
    >
      <input
        type="radio"
        name={nombre}
        value={valor}
        checked={seleccionado}
        onChange={() => onChange(valor)}
        className="mt-0.5 size-4 shrink-0 accent-[#2D5DA1]"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{titulo}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-tenue">
          {detalle}
        </span>
      </span>
    </label>
  );
}

/** Grilla de formulario: una columna en mobile, dos desde sm. */
export function GrillaCampos({
  children,
  columnas = 2,
}: {
  children: ReactNode;
  columnas?: 1 | 2 | 3;
}) {
  const clases = {
    1: "grid-cols-1",
    2: "grid-cols-1 sm:grid-cols-2",
    3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  }[columnas];

  return <div className={`grid gap-4 ${clases}`}>{children}</div>;
}

/** Fila de acciones al pie de un formulario. */
export function AccionesForm({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-2.5 border-t border-borde-suave pt-5">
      {children}
    </div>
  );
}
