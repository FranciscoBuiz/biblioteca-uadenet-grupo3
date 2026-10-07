"use client";

import { useState } from "react";
import { Cabecera, Contenido } from "@/components/shell/Cabecera";
import { BotonNotificaciones } from "@/components/shell/PanelNotificaciones";
import { BotonLink } from "@/components/ui/Boton";
import { Aviso, Card } from "@/components/ui/Card";
import { Tabs, type Opcion } from "@/components/ui/Filtros";
import { EstadoSancionPill } from "@/components/ui/StatusPill";
import { Mono, SinResultados, TablaDatos } from "@/components/ui/Tabla";
import {
  enDias,
  formatFecha,
  formatMonto,
} from "@/lib/domain/rules";
import type { PenaltyView } from "@/lib/domain/types";
import { useDb, useUsuarioActual } from "@/lib/store/LibraryProvider";
import { sancionesDe } from "@/lib/store/selectors";

/* ---------------------------------------------------------------
   Listado de sanciones del estudiante (item "Sanciones" del menu).

   No tiene mockup propio: toma la estructura de pestanas + tabla de
   la pantalla 07 y las columnas de la vista administrativa 22,
   recortadas a lo que le importa al estudiante.
   --------------------------------------------------------------- */

type Filtro = "todas" | "pendientes" | "cobradas";

function cumple(sancion: PenaltyView, filtro: Filtro): boolean {
  if (filtro === "pendientes") return sancion.estado === "pendiente";
  if (filtro === "cobradas") return sancion.estado === "cobrada";
  return true;
}

const VACIO: Record<Filtro, { titulo: string; detalle: string }> = {
  todas: {
    titulo: "No tenés sanciones",
    detalle: "Devolvé los ejemplares en fecha y tu legajo queda sin multas.",
  },
  pendientes: {
    titulo: "No tenés multas pendientes",
    detalle: "Podés seguir solicitando préstamos con normalidad.",
  },
  cobradas: {
    titulo: "No tenés multas cobradas",
    detalle: "Acá vas a ver el historial de los pagos que registres.",
  },
};

export default function MisSanciones() {
  const db = useDb();
  const usuario = useUsuarioActual();
  const [filtro, setFiltro] = useState<Filtro>("todas");

  const mis = sancionesDe(db, usuario.id);
  const visibles = mis.filter((s) => cumple(s, filtro));
  const pendientes = mis.filter((s) => s.estado === "pendiente").length;

  const opciones: Opcion<Filtro>[] = [
    { id: "todas", etiqueta: "Todas", cantidad: mis.length },
    { id: "pendientes", etiqueta: "Pendientes", cantidad: pendientes },
    {
      id: "cobradas",
      etiqueta: "Cobradas",
      cantidad: mis.length - pendientes,
    },
  ];

  return (
    <>
      <Cabecera
        migas={[{ etiqueta: "Biblioteca" }, { etiqueta: "Sanciones" }]}
        titulo="Sanciones y multas"
      >
        <BotonNotificaciones userId={usuario.id} />
      </Cabecera>

      <Contenido>
        {pendientes > 0 && (
          <div className="mb-4">
            <Aviso tono="alerta" titulo="Tenés una multa impaga">
              Mientras quede una multa sin pagar no vas a poder solicitar
              préstamos nuevos. Regularizá el pago desde el detalle de la
              sanción.
            </Aviso>
          </div>
        )}

        <Tabs
          opciones={opciones}
          valor={filtro}
          onChange={setFiltro}
          etiquetaGrupo="Filtrar sanciones por estado"
        />

        <div className="mt-4">
          <Card padding={false}>
            <TablaDatos
              etiqueta="Sanciones del estudiante"
              filas={visibles}
              claveFila={(s) => s.id}
              vacio={
                <SinResultados
                  titulo={VACIO[filtro].titulo}
                  detalle={VACIO[filtro].detalle}
                />
              }
              columnas={[
                {
                  clave: "id",
                  titulo: "ID",
                  render: (s) => <Mono>{s.id}</Mono>,
                },
                {
                  clave: "libro",
                  titulo: "Libro",
                  principal: true,
                  render: (s) => s.libro.titulo,
                },
                {
                  clave: "prestamo",
                  titulo: "Préstamo",
                  render: (s) => <Mono>{s.loanId}</Mono>,
                },
                {
                  clave: "limite",
                  titulo: "Fecha límite original",
                  render: (s) => (
                    <span className="text-grafito">
                      {formatFecha(s.fechaLimiteOriginal)}
                    </span>
                  ),
                },
                {
                  clave: "atraso",
                  titulo: "Días de atraso",
                  render: (s) => (
                    <span className="font-semibold text-rojo">
                      {enDias(s.diasAtraso)}
                    </span>
                  ),
                },
                {
                  clave: "multa",
                  titulo: "Multa",
                  render: (s) => (
                    <span className="font-semibold">
                      {formatMonto(s.monto)}
                    </span>
                  ),
                },
                {
                  clave: "estado",
                  titulo: "Estado",
                  render: (s) => <EstadoSancionPill estado={s.estado} />,
                },
                {
                  clave: "accion",
                  titulo: "Acción",
                  accion: true,
                  alinear: "derecha",
                  render: (s) => (
                    <BotonLink href={`/sanciones/${s.id}`} tamano="pill">
                      Ver detalle
                    </BotonLink>
                  ),
                },
              ]}
            />
          </Card>
        </div>
      </Contenido>
    </>
  );
}
