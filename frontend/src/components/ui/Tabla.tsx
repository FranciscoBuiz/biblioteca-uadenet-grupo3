import type { ReactNode } from "react";

/* ---------------------------------------------------------------
   Tabla de datos con dos presentaciones a partir de una sola
   definicion de columnas: tabla real desde md, y tarjetas apiladas
   en mobile, donde una tabla de 8 columnas no se puede leer.
   --------------------------------------------------------------- */

export interface Columna<T> {
  clave: string;
  titulo: string;
  render: (fila: T) => ReactNode;
  /** Columna que encabeza la tarjeta en mobile. Marcar una sola. */
  principal?: boolean;
  /** Columna de acciones: va al pie de la tarjeta en mobile. */
  accion?: boolean;
  /** Se muestra en la tabla pero se omite en la tarjeta. */
  soloTabla?: boolean;
  alinear?: "izquierda" | "derecha";
  ancho?: string;
}

const ALINEACION = {
  izquierda: "text-left",
  derecha: "text-right",
} as const;

export function TablaDatos<T>({
  columnas,
  filas,
  claveFila,
  vacio,
  etiqueta,
  claseFila,
}: {
  columnas: Columna<T>[];
  filas: T[];
  claveFila: (fila: T) => string;
  /** Qué mostrar cuando no hay resultados. */
  vacio?: ReactNode;
  /** Descripción accesible de la tabla. */
  etiqueta: string;
  /** Clases extra por fila, p. ej. para atenuar un registro dado de baja. */
  claseFila?: (fila: T) => string;
}) {
  if (filas.length === 0) {
    return <div className="px-5 py-10">{vacio ?? <SinResultados />}</div>;
  }

  // Ancho minimo proporcional a las columnas: las tablas anchas scrollean,
  // las de pocas columnas entran completas aunque el contenedor sea angosto.
  const anchoMinimo = Math.min(960, Math.max(320, columnas.length * 110));

  const principal = columnas.find((c) => c.principal) ?? columnas[0];
  const acciones = columnas.filter((c) => c.accion);
  const secundarias = columnas.filter(
    (c) => c !== principal && !c.accion && !c.soloTabla,
  );

  return (
    <>
      {/* Tabla completa desde md */}
      <div className="scroll-fino hidden overflow-x-auto md:block">
        <table
          className="w-full border-collapse"
          style={{ minWidth: `${anchoMinimo}px` }}
        >
          <caption className="sr-only">{etiqueta}</caption>
          <thead>
            <tr className="border-b border-borde-suave bg-[#FBFCFD]">
              {columnas.map((columna) => (
                <th
                  key={columna.clave}
                  scope="col"
                  style={columna.ancho ? { width: columna.ancho } : undefined}
                  className={[
                    "px-5 py-3 text-[11px] font-semibold uppercase tracking-wide text-apagado",
                    ALINEACION[columna.alinear ?? "izquierda"],
                  ].join(" ")}
                >
                  {columna.titulo}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr
                key={claveFila(fila)}
                className={[
                  "border-b border-borde-fino last:border-b-0 hover:bg-[#FBFCFD]",
                  claseFila?.(fila) ?? "",
                ].join(" ")}
              >
                {columnas.map((columna) => (
                  <td
                    key={columna.clave}
                    className={[
                      "px-5 py-3.5 align-middle text-[13px]",
                      ALINEACION[columna.alinear ?? "izquierda"],
                    ].join(" ")}
                  >
                    {columna.render(fila)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tarjetas apiladas en mobile */}
      <ul className="divide-y divide-borde-fino md:hidden">
        {filas.map((fila) => (
          <li
            key={claveFila(fila)}
            className={["px-4 py-4", claseFila?.(fila) ?? ""].join(" ")}
          >
            <div className="text-sm font-semibold">{principal.render(fila)}</div>
            <dl className="mt-2.5 space-y-1.5">
              {secundarias.map((columna) => (
                <div
                  key={columna.clave}
                  className="flex items-baseline justify-between gap-4"
                >
                  <dt className="text-[11px] uppercase tracking-wide text-apagado">
                    {columna.titulo}
                  </dt>
                  <dd className="text-right text-[13px]">
                    {columna.render(fila)}
                  </dd>
                </div>
              ))}
            </dl>
            {acciones.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {acciones.map((columna) => (
                  <div key={columna.clave}>{columna.render(fila)}</div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

export function SinResultados({
  titulo = "No hay resultados",
  detalle = "Probá con otro término de búsqueda o cambiá los filtros.",
}: {
  titulo?: string;
  detalle?: string;
}) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-3 size-10 rounded-full bg-borde-fino" aria-hidden />
      <p className="text-sm font-semibold">{titulo}</p>
      <p className="mx-auto mt-1 max-w-sm text-[13px] text-tenue">{detalle}</p>
    </div>
  );
}

/** Celda de dos lineas: dato principal arriba y detalle gris abajo. */
export function CeldaDoble({
  principal,
  detalle,
}: {
  principal: ReactNode;
  detalle?: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="truncate font-semibold">{principal}</div>
      {detalle && (
        <div className="mt-0.5 truncate text-xs text-tenue">{detalle}</div>
      )}
    </div>
  );
}

/** Codigo de inventario o identificador, en monoespaciada. */
export function Mono({ children }: { children: ReactNode }) {
  return (
    <span className="font-mono text-xs tracking-tight text-tenue">
      {children}
    </span>
  );
}
