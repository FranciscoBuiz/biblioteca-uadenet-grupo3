"use client";

import { useParams } from "next/navigation";
import { Cabecera, Contenido } from "@/components/shell/Cabecera";
import { BotonNotificaciones } from "@/components/shell/PanelNotificaciones";
import { BotonLink } from "@/components/ui/Boton";
import { Aviso, Card, Dato, Datos } from "@/components/ui/Card";
import { EstadoSancionPill } from "@/components/ui/StatusPill";
import { Mono, SinResultados } from "@/components/ui/Tabla";
import {
  DIAS_TOLERANCIA,
  enDias,
  formatFecha,
  formatMonto,
  nombreSede,
} from "@/lib/domain/rules";
import type { PenaltyView, SedeId } from "@/lib/domain/types";
import { useDb, useUsuarioActual } from "@/lib/store/LibraryProvider";
import { prestamosDe, sancionesDe } from "@/lib/store/selectors";

/* ---------------------------------------------------------------
   Pantalla 09: ficha de la sancion por devolucion tardia, con el
   monto destacado y el acceso al pago.
   --------------------------------------------------------------- */

export default function DetalleSancion() {
  const { id } = useParams<{ id: string }>();
  const db = useDb();
  const usuario = useUsuarioActual();

  const sancion = sancionesDe(db, usuario.id).find((s) => s.id === id) ?? null;
  const prestamo = sancion
    ? (prestamosDe(db, usuario.id).find((p) => p.id === sancion.loanId) ?? null)
    : null;

  return (
    <>
      <Cabecera
        migas={[
          { etiqueta: "Biblioteca" },
          { etiqueta: "Sanciones", href: "/sanciones" },
          { etiqueta: id },
        ]}
        titulo="Detalle de sanción"
      >
        <BotonNotificaciones userId={usuario.id} />
      </Cabecera>

      <Contenido ancho="angosto">
        {!sancion ? (
          <Card>
            <SinResultados
              titulo="No encontramos esa sanción"
              detalle="Puede que el identificador esté mal escrito o que la sanción sea de otra cuenta."
            />
            <div className="mt-5 flex justify-center">
              <BotonLink href="/sanciones" variante="neutro" tamano="chico">
                Volver a mis sanciones
              </BotonLink>
            </div>
          </Card>
        ) : (
          <FichaSancion
            sancion={sancion}
            sede={prestamo?.sede ?? usuario.sedeDefault}
          />
        )}
      </Contenido>
    </>
  );
}

function FichaSancion({
  sancion,
  sede,
}: {
  sancion: PenaltyView;
  sede: SedeId;
}) {
  return (
    <Card padding={false} className="border-[#F0C9C9]">
      {/* Banda roja del mockup: concepto a la izquierda, monto a la derecha */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-error-bg px-5 py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[1.4px] text-error-fg">
            Sanción por devolución tardía
          </p>
          <h2 className="serif mt-0.5 text-lg sm:text-[21px]">
            {sancion.id} · {sancion.libro.titulo}
          </h2>
        </div>
        <div className="text-right">
          <p className="serif text-[26px] leading-none text-rojo">
            {formatMonto(sancion.monto)}
          </p>
          <div className="mt-1.5">
            <EstadoSancionPill estado={sancion.estado} />
          </div>
        </div>
      </div>

      <div className="px-5 py-4">
        <Datos>
          <Dato label="Préstamo" destacado>
            <Mono>{sancion.loanId}</Mono>
          </Dato>
          <Dato label="ISBN" destacado>
            <Mono>{sancion.isbn}</Mono>
          </Dato>
          <Dato label="Fecha límite original" destacado>
            {formatFecha(sancion.fechaLimiteOriginal)}
          </Dato>
          <Dato label="Detección del atraso" destacado>
            {formatFecha(sancion.fechaDeteccion)}
          </Dato>
          <Dato label="Días de atraso" destacado>
            {enDias(sancion.diasAtraso)}
          </Dato>
          <Dato label="Fecha de cobro" destacado>
            {sancion.fechaCobro ? formatFecha(sancion.fechaCobro) : "—"}
          </Dato>
          <Dato label="Motivo" destacado>
            Devolución con más de {enDias(DIAS_TOLERANCIA)} de atraso
          </Dato>
        </Datos>

        <div className="mt-4">
          <Aviso tono="info">
            Para regularizar tu situación, devolvé el ejemplar en la sede{" "}
            {nombreSede(sede)}. El préstamo se cierra cuando el bibliotecario
            confirma la recepción del libro.
          </Aviso>
        </div>

        <div className="mt-4 flex flex-wrap gap-2.5">
          {sancion.estado === "pendiente" && (
            <BotonLink
              href={`/sanciones/${sancion.id}/pago`}
              variante="confirmar"
              tamano="chico"
            >
              Pagar multa
            </BotonLink>
          )}
          <BotonLink
            href={`/prestamos/${sancion.loanId}`}
            variante="neutro"
            tamano="chico"
          >
            Ver préstamo
          </BotonLink>
        </div>
      </div>
    </Card>
  );
}
