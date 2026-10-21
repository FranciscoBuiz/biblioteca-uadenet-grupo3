"use client";

import { Cabecera, Contenido } from "@/components/shell/Cabecera";
import { BotonLink } from "@/components/ui/Boton";
import { Card, CardHeader, StatCard } from "@/components/ui/Card";
import { Pill } from "@/components/ui/StatusPill";
import { CeldaDoble, SinResultados, TablaDatos } from "@/components/ui/Tabla";
import {
  enDias,
  formatFecha,
  HOY,
  nombreSede,
} from "@/lib/domain/rules";
import type { Activity, TipoActividad } from "@/lib/domain/types";
import { useDb } from "@/lib/store/LibraryProvider";
import { indicadores, prestamosVencidos } from "@/lib/store/selectors";

/* ---------------------------------------------------------------
   Pantalla 14: panel del bibliotecario.

   Cinco indicadores de inventario arriba y, abajo, la tabla de
   prestamos vencidos a la izquierda con el feed de actividad
   reciente a la derecha.

   Las pantallas de admin no llevan el boton de notificaciones: el
   mockup solo muestra el selector de sede en la cabecera.
   --------------------------------------------------------------- */

export default function PanelBibliotecario() {
  const db = useDb();
  const totales = indicadores(db);
  const vencidos = prestamosVencidos(db);

  return (
    <>
      <Cabecera
        migas={[{ etiqueta: "Biblioteca" }, { etiqueta: "Inicio" }]}
        titulo="Panel de administración"
      />

      <Contenido>
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-5">
          <StatCard label="Títulos" valor={totales.titulos} pie="En catálogo" />
          <StatCard
            label="Ejemplares"
            valor={totales.ejemplares}
            pie="Físicos totales"
          />
          <StatCard
            label="Disponibles"
            valor={totales.disponibles}
            pie="Listos para prestar"
            tono="verde"
          />
          <StatCard
            label="Prestados"
            valor={totales.prestados}
            pie="Fuera de sede"
            tono="azul"
          />
          <StatCard
            label="Vencidos"
            valor={totales.vencidos}
            pie="Requieren seguimiento"
            tono="rojo"
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[2fr_1fr] lg:items-start">
          <Card padding={false}>
            <CardHeader titulo="Préstamos vencidos" />
            <TablaDatos
              etiqueta="Préstamos vencidos sin devolver"
              filas={vencidos}
              claveFila={(prestamo) => prestamo.id}
              vacio={
                <SinResultados
                  titulo="No hay préstamos vencidos"
                  detalle="Todos los ejemplares prestados están dentro del plazo."
                />
              }
              columnas={[
                {
                  clave: "libro",
                  titulo: "Libro",
                  principal: true,
                  render: (prestamo) => (
                    <CeldaDoble
                      principal={prestamo.libro.titulo}
                      detalle={`${prestamo.estudiante.nombre} · ${nombreSede(
                        prestamo.sede,
                      )} · Límite ${formatFecha(prestamo.fechaLimite)}`}
                    />
                  ),
                },
                {
                  clave: "atraso",
                  titulo: "Atraso",
                  render: (prestamo) => (
                    <Pill tono="rojo">
                      {enDias(prestamo.diasAtraso)}
                    </Pill>
                  ),
                },
                {
                  clave: "accion",
                  titulo: "Acción",
                  accion: true,
                  alinear: "derecha",
                  render: (prestamo) => (
                    <BotonLink
                      href={`/admin/devolucion?q=${prestamo.id}`}
                      tamano="pill"
                    >
                      Devolución
                    </BotonLink>
                  ),
                },
              ]}
            />
          </Card>

          <Card>
            <h2 className="text-[15px] font-semibold">Actividad reciente</h2>
            {db.actividad.length === 0 ? (
              <p className="mt-3 text-[13px] text-tenue">
                Todavía no hay movimientos registrados.
              </p>
            ) : (
              <ul className="mt-3.5 flex flex-col gap-3.5">
                {db.actividad.slice(0, 6).map((entrada) => (
                  <FilaActividad key={entrada.id} actividad={entrada} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </Contenido>
    </>
  );
}

/** Color del punto segun el tipo de movimiento, como en el mockup. */
const PUNTO: Record<TipoActividad, string> = {
  devolucion: "bg-verde",
  prestamo: "bg-secundario",
  sancion: "bg-rojo",
  alta_ejemplar: "bg-apagado",
};

function FilaActividad({ actividad }: { actividad: Activity }) {
  // La maqueta escribe "hoy" en lugar de la fecha del dia en curso.
  const cuando =
    actividad.fecha === HOY ? "hoy" : formatFecha(actividad.fecha);

  return (
    <li className="flex gap-2.5">
      <span
        aria-hidden
        className={`mt-1.5 size-[7px] shrink-0 rounded-full ${PUNTO[actividad.tipo]}`}
      />
      <div className="min-w-0">
        <p className="text-[13px] font-medium leading-snug">
          {actividad.texto}
        </p>
        <p className="mt-0.5 text-[11px] text-apagado">
          {cuando} {actividad.hora}
        </p>
      </div>
    </li>
  );
}
