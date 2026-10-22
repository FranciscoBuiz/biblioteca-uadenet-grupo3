"use client";

import { useState } from "react";
import { Cabecera, Contenido } from "@/components/shell/Cabecera";
import { BotonNotificaciones } from "@/components/shell/PanelNotificaciones";
import { BotonLink } from "@/components/ui/Boton";
import { Card } from "@/components/ui/Card";
import { Tabs, type Opcion } from "@/components/ui/Filtros";
import { EstadoPrestamoPill } from "@/components/ui/StatusPill";
import {
  CeldaDoble,
  Mono,
  SinResultados,
  TablaDatos,
} from "@/components/ui/Tabla";
import {
  detalleEstadoPrestamo,
  formatFecha,
  nombreSede,
} from "@/lib/domain/rules";
import type { LoanView } from "@/lib/domain/types";
import { SinDatos } from "@/components/ui/SinDatos";
import { getLoans } from "@/lib/api/loans";
import { useApi } from "@/lib/api/useApi";

/* ---------------------------------------------------------------
   Pantalla 07: seguimiento de los prestamos del estudiante.

   Pestanas de estado sobre la tabla y, en cada fila, el estado con
   su segunda linea ("2 dias restantes", "3 dias de atraso").
   --------------------------------------------------------------- */

type Filtro = "activos" | "vencidos" | "devueltos" | "todos";

function cumple(prestamo: LoanView, filtro: Filtro): boolean {
  if (filtro === "activos") return !prestamo.fechaDevolucion;
  if (filtro === "vencidos") {
    return !prestamo.fechaDevolucion && prestamo.diasAtraso > 0;
  }
  if (filtro === "devueltos") return prestamo.fechaDevolucion !== null;
  return true;
}

const VACIO: Record<Filtro, { titulo: string; detalle: string }> = {
  activos: {
    titulo: "No tenés préstamos activos",
    detalle: "Buscá un título en el catálogo y solicitá un ejemplar.",
  },
  vencidos: {
    titulo: "No tenés préstamos vencidos",
    detalle: "Seguí devolviendo en fecha para evitar sanciones.",
  },
  devueltos: {
    titulo: "Todavía no devolviste ningún préstamo",
    detalle: "Acá vas a ver el historial de tus devoluciones.",
  },
  todos: {
    titulo: "Todavía no pediste préstamos",
    detalle: "Buscá un título en el catálogo y solicitá un ejemplar.",
  },
};

export default function MisPrestamos() {
  const [filtro, setFiltro] = useState<Filtro>("todos");

  const { datos, error } = useApi(() => getLoans(), []);
  const mis = datos ?? [];
  const visibles = mis.filter((p) => cumple(p, filtro));

  const opciones: Opcion<Filtro>[] = [
    { id: "activos", etiqueta: "Activos", cantidad: mis.filter((p) => cumple(p, "activos")).length },
    { id: "vencidos", etiqueta: "Vencidos", cantidad: mis.filter((p) => cumple(p, "vencidos")).length },
    { id: "devueltos", etiqueta: "Devueltos", cantidad: mis.filter((p) => cumple(p, "devueltos")).length },
    { id: "todos", etiqueta: "Todos", cantidad: mis.length },
  ];

  return (
    <>
      <Cabecera
        migas={[{ etiqueta: "Biblioteca" }, { etiqueta: "Mis préstamos" }]}
        titulo="Mis préstamos"
      >
        <BotonNotificaciones />
      </Cabecera>

      <Contenido>
        {!datos ? (
          <SinDatos error={error} />
        ) : (
          <>
        <Tabs
          opciones={opciones}
          valor={filtro}
          onChange={setFiltro}
          etiquetaGrupo="Filtrar préstamos por estado"
        />

        <div className="mt-4">
          <Card padding={false}>
            <TablaDatos
              etiqueta="Préstamos del estudiante"
              filas={visibles}
              claveFila={(p) => p.id}
              vacio={
                <SinResultados
                  titulo={VACIO[filtro].titulo}
                  detalle={VACIO[filtro].detalle}
                />
              }
              columnas={[
                {
                  clave: "libro",
                  titulo: "Libro",
                  principal: true,
                  render: (p) => (
                    <CeldaDoble
                      principal={p.libro.titulo}
                      detalle={<Mono>{p.id}</Mono>}
                    />
                  ),
                },
                {
                  clave: "sede",
                  titulo: "Sede",
                  render: (p) => (
                    <span className="text-grafito">{nombreSede(p.sede)}</span>
                  ),
                },
                {
                  clave: "prestamo",
                  titulo: "Préstamo",
                  render: (p) => (
                    <span className="text-grafito">
                      {formatFecha(p.fechaPrestamo)}
                    </span>
                  ),
                },
                {
                  clave: "limite",
                  titulo: "Fecha límite",
                  render: (p) => (
                    <span className="text-grafito">
                      {formatFecha(p.fechaLimite)}
                    </span>
                  ),
                },
                {
                  clave: "estado",
                  titulo: "Estado",
                  render: (p) => (
                    <EstadoPrestamoPill
                      estado={p.estado}
                      detalle={detalleEstadoPrestamo(p)}
                    />
                  ),
                },
                {
                  clave: "accion",
                  titulo: "Acción",
                  accion: true,
                  alinear: "derecha",
                  render: (p) => (
                    <BotonLink href={`/prestamos/${p.id}`} tamano="pill">
                      Ver detalle
                    </BotonLink>
                  ),
                },
              ]}
            />
          </Card>
        </div>
          </>
        )}
      </Contenido>
    </>
  );
}
