"use client";

import { useState } from "react";
import { Cabecera, Contenido } from "@/components/shell/Cabecera";
import { BotonLink } from "@/components/ui/Boton";
import { Card } from "@/components/ui/Card";
import { BarraFiltros, Buscador, Tabs } from "@/components/ui/Filtros";
import { EstadoPrestamoPill } from "@/components/ui/StatusPill";
import { CeldaDoble, Mono, SinResultados, TablaDatos } from "@/components/ui/Tabla";
import { detalleEstadoPrestamo, formatFecha, nombreSede } from "@/lib/domain/rules";
import { SinDatos } from "@/components/ui/SinDatos";
import { getLoans, type FiltroPrestamos } from "@/lib/api/loans";
import { useApi } from "@/lib/api/useApi";
import type { LoanView } from "@/lib/domain/types";

/* ---------------------------------------------------------------
   Pantalla 20: gestion de prestamos.

   A diferencia de "Mis prestamos", lista los de todo el sistema y
   permite buscar por ID, DNI, legajo, nombre o ISBN.
   --------------------------------------------------------------- */

type Estado = NonNullable<FiltroPrestamos["estado"]>;

export default function PrestamosAdmin() {
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<Estado>("activos");

  // Se pide la busqueda completa y las pestanas se resuelven aca, asi los
  // contadores de todas salen de una sola respuesta.
  const { datos, error } = useApi(() => getLoans({ q }), [q]);
  const cumple = (p: LoanView, filtro: Estado) =>
    filtro === "todos" ||
    (filtro === "activos" && !p.fechaDevolucion) ||
    (filtro === "vencidos" && !p.fechaDevolucion && p.diasAtraso > 0) ||
    (filtro === "devueltos" && p.fechaDevolucion !== null);
  const todos = datos ?? [];
  const filtrados = todos.filter((p) => cumple(p, estado));
  const contar = (filtro: Estado) => todos.filter((p) => cumple(p, filtro)).length;

  return (
    <>
      <Cabecera
        migas={[{ etiqueta: "Biblioteca" }, { etiqueta: "Préstamos" }]}
        titulo="Gestión de préstamos"
      />

      <Contenido>
        <BarraFiltros>
          <Buscador
            valor={q}
            onChange={setQ}
            placeholder="Buscar por ID de préstamo, DNI, legajo, nombre o ISBN"
          />
        </BarraFiltros>

        <div className="mt-3.5">
          <Tabs
            valor={estado}
            onChange={setEstado}
            opciones={[
              { id: "activos", etiqueta: "Activos", cantidad: contar("activos") },
              { id: "vencidos", etiqueta: "Vencidos", cantidad: contar("vencidos") },
              { id: "devueltos", etiqueta: "Devueltos", cantidad: contar("devueltos") },
              { id: "todos", etiqueta: "Todos", cantidad: contar("todos") },
            ]}
          />
        </div>

        {!datos ? (
          <div className="mt-4">
            <SinDatos error={error} />
          </div>
        ) : (
        <Card padding={false} className="mt-4">
          <TablaDatos
            etiqueta="Préstamos del sistema"
            filas={filtrados}
            claveFila={(p) => p.id}
            vacio={
              <SinResultados
                titulo="No hay préstamos para mostrar"
                detalle={
                  q.trim()
                    ? "Ningún préstamo coincide con la búsqueda. Probá con el ID, el DNI o el legajo."
                    : "Cuando se registren préstamos en este estado van a aparecer acá."
                }
              />
            }
            columnas={[
              {
                clave: "id",
                titulo: "ID",
                ancho: "110px",
                render: (p) => <Mono>{p.id}</Mono>,
              },
              {
                clave: "estudiante",
                titulo: "Estudiante",
                principal: true,
                render: (p) => (
                  <CeldaDoble
                    principal={p.estudiante.nombre}
                    detalle={`Legajo ${p.estudiante.legajo}`}
                  />
                ),
              },
              {
                clave: "libro",
                titulo: "Libro",
                render: (p) => (
                  <CeldaDoble principal={p.libro.titulo} detalle={p.copia} />
                ),
              },
              {
                clave: "sede",
                titulo: "Sede",
                render: (p) => nombreSede(p.sede),
              },
              {
                clave: "prestamo",
                titulo: "Préstamo",
                render: (p) => formatFecha(p.fechaPrestamo),
              },
              {
                clave: "limite",
                titulo: "Límite",
                render: (p) => formatFecha(p.fechaLimite),
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
                render: (p) =>
                  p.fechaDevolucion ? (
                    <span className="text-xs text-apagado">
                      Devuelto {formatFecha(p.fechaDevolucion)}
                    </span>
                  ) : (
                    <BotonLink
                      href={`/admin/devolucion?q=${p.id}`}
                      tamano="pill"
                      variante="avanzar"
                    >
                      Devolución
                    </BotonLink>
                  ),
              },
            ]}
          />
        </Card>
        )}
      </Contenido>
    </>
  );
}
