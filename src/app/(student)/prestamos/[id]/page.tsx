"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Cabecera, Contenido } from "@/components/shell/Cabecera";
import { BotonNotificaciones } from "@/components/shell/PanelNotificaciones";
import { Boton, BotonLink } from "@/components/ui/Boton";
import { Aviso, Card, Dato, Datos } from "@/components/ui/Card";
import { EstadoPrestamoPill } from "@/components/ui/StatusPill";
import { Mono, SinResultados } from "@/components/ui/Tabla";
import { mensajeDeError } from "@/lib/api/errors";
import { renewLoan } from "@/lib/api/loans";
import {
  DIAS_RENOVACION,
  enDias,
  formatFecha,
  MAX_RENOVACIONES,
  nombreSede,
  puedeRenovar,
} from "@/lib/domain/rules";
import type { LoanView } from "@/lib/domain/types";
import { useDb, useUsuarioActual } from "@/lib/store/LibraryProvider";
import { prestamosDe } from "@/lib/store/selectors";

/* ---------------------------------------------------------------
   Pantalla 08: ficha de un prestamo con sus fechas, el ejemplar
   asignado y la renovacion.

   Mostramos solo prestamos del estudiante de la sesion: la lista se
   filtra por usuario antes de buscar el id de la URL.
   --------------------------------------------------------------- */

/** Texto del renglon "Dias restantes" segun en que situacion esta el prestamo. */
function textoDias(prestamo: LoanView): string {
  if (prestamo.fechaDevolucion) {
    return `Devuelto el ${formatFecha(prestamo.fechaDevolucion)}`;
  }
  if (prestamo.diasAtraso > 0) return `${enDias(prestamo.diasAtraso)} de atraso`;
  return enDias(prestamo.diasRestantes);
}

export default function DetallePrestamo() {
  const { id } = useParams<{ id: string }>();
  const db = useDb();
  const usuario = useUsuarioActual();

  const [error, setError] = useState<string | null>(null);
  const [renovado, setRenovado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const prestamo = prestamosDe(db, usuario.id).find((p) => p.id === id) ?? null;

  async function renovar() {
    if (!prestamo) return;
    setError(null);
    setEnviando(true);
    try {
      const actualizado = await renewLoan(prestamo.id);
      setRenovado(
        `Renovamos el préstamo por ${enDias(DIAS_RENOVACION)}. La nueva fecha límite es el ${formatFecha(actualizado.fechaLimite)}.`,
      );
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <Cabecera
        migas={[
          { etiqueta: "Biblioteca" },
          { etiqueta: "Mis préstamos", href: "/prestamos" },
          { etiqueta: id },
        ]}
        titulo="Detalle de préstamo"
      >
        <BotonNotificaciones userId={usuario.id} />
      </Cabecera>

      <Contenido ancho="angosto">
        {!prestamo ? (
          <Card>
            <SinResultados
              titulo="No encontramos ese préstamo"
              detalle="Puede que el identificador esté mal escrito o que el préstamo sea de otra cuenta."
            />
            <div className="mt-5 flex justify-center">
              <BotonLink href="/prestamos" variante="neutro" tamano="chico">
                Volver a mis préstamos
              </BotonLink>
            </div>
          </Card>
        ) : (
          <FichaPrestamo
            prestamo={prestamo}
            error={error}
            renovado={renovado}
            enviando={enviando}
            onRenovar={renovar}
          />
        )}
      </Contenido>
    </>
  );
}

function FichaPrestamo({
  prestamo,
  error,
  renovado,
  enviando,
  onRenovar,
}: {
  prestamo: LoanView;
  error: string | null;
  renovado: string | null;
  enviando: boolean;
  onRenovar: () => void;
}) {
  const evaluacion = puedeRenovar(prestamo, prestamo.sancion);

  return (
    <Card>
      {/* Encabezado de la ficha */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="serif text-xl sm:text-[23px]">
            {prestamo.libro.titulo}
          </h2>
          <p className="mt-1 text-[13px] text-tenue">
            {prestamo.libro.autor} · {nombreSede(prestamo.sede)}
          </p>
        </div>
        <EstadoPrestamoPill estado={prestamo.estado} />
      </div>

      <div className="mt-4 rounded-[12px] border border-borde-suave px-4">
        <Datos>
          <Dato label="ID de préstamo" destacado>
            <Mono>{prestamo.id}</Mono>
          </Dato>
          <Dato label="Ejemplar" destacado>
            <Mono>{prestamo.copia}</Mono>
          </Dato>
          <Dato label="Fecha de préstamo" destacado>
            {formatFecha(prestamo.fechaPrestamo)}
          </Dato>
          <Dato label="Fecha límite" destacado>
            {formatFecha(prestamo.fechaLimite)}
          </Dato>
          <Dato label="Días restantes" destacado>
            {textoDias(prestamo)}
          </Dato>
          <Dato label="Renovaciones" destacado>
            {prestamo.renovaciones} de {MAX_RENOVACIONES}
          </Dato>
        </Datos>
      </div>

      {/* Renovacion: el motivo que devuelve puedeRenovar ya es texto de pantalla */}
      <div className="mt-4 flex flex-col gap-3">
        {renovado ? (
          <Aviso tono="ok" titulo="Préstamo renovado">
            {renovado}
          </Aviso>
        ) : (
          <Aviso tono={evaluacion.puede ? "info" : "alerta"}>
            {evaluacion.motivo}
          </Aviso>
        )}

        {error && <Aviso tono="error">{error}</Aviso>}

        {prestamo.sancion && (
          <p className="text-[13px] text-tenue">
            Este préstamo tiene una sanción asociada.{" "}
            <Link
              href={`/sanciones/${prestamo.sancion.id}`}
              className="font-semibold text-secundario hover:text-institucional"
            >
              Ver sanción
            </Link>
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-wrap gap-2.5">
        <Boton
          variante="avanzar"
          tamano="chico"
          disabled={!evaluacion.puede || renovado !== null}
          cargando={enviando}
          onClick={onRenovar}
        >
          Renovar por {enDias(DIAS_RENOVACION)}
        </Boton>
        <BotonLink href="/prestamos" variante="neutro" tamano="chico">
          Volver
        </BotonLink>
      </div>
    </Card>
  );
}
