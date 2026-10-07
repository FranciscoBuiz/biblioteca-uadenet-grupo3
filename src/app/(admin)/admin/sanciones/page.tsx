"use client";

import { useState } from "react";
import { Cabecera, Contenido } from "@/components/shell/Cabecera";
import { BotonLink } from "@/components/ui/Boton";
import { Card, StatCard } from "@/components/ui/Card";
import { BarraFiltros, Buscador, Tabs } from "@/components/ui/Filtros";
import { EstadoSancionPill } from "@/components/ui/StatusPill";
import { CeldaDoble, Mono, SinResultados, TablaDatos } from "@/components/ui/Tabla";
import { formatFecha, formatMonto } from "@/lib/domain/rules";
import { useDb } from "@/lib/store/LibraryProvider";
import {
  filtrarSanciones,
  sanciones,
  type FiltroSanciones,
} from "@/lib/store/selectors";

/* ---------------------------------------------------------------
   Pantalla 22: sanciones y multas.

   Contraparte administrativa del "Pago de la sancion" del
   estudiante: aca el bibliotecario controla que multas siguen
   pendientes de regularizar.
   --------------------------------------------------------------- */

type Estado = NonNullable<FiltroSanciones["estado"]>;

export default function SancionesAdmin() {
  const db = useDb();
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState<Estado>("todas");

  const todas = sanciones(db);
  const filtradas = filtrarSanciones(db, { q, estado });
  const contar = (filtro: Estado) =>
    filtrarSanciones(db, { q, estado: filtro }).length;

  const pendientes = todas.filter((s) => s.estado === "pendiente");
  const aCobrar = pendientes.reduce((total, s) => total + s.monto, 0);
  const cobrado = todas
    .filter((s) => s.estado === "cobrada")
    .reduce((total, s) => total + s.monto, 0);

  return (
    <>
      <Cabecera
        migas={[{ etiqueta: "Biblioteca" }, { etiqueta: "Sanciones" }]}
        titulo="Sanciones y multas"
      />

      <Contenido>
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
          <StatCard
            label="Sanciones"
            valor={todas.length}
            pie="Generadas en el sistema"
          />
          <StatCard
            label="Pendientes"
            valor={pendientes.length}
            pie={`${formatMonto(aCobrar)} por cobrar`}
            tono="rojo"
          />
          <StatCard
            label="Cobradas"
            valor={todas.length - pendientes.length}
            pie={`${formatMonto(cobrado)} regularizados`}
            tono="verde"
          />
        </div>

        <div className="mt-5">
          <BarraFiltros>
            <Buscador
              valor={q}
              onChange={setQ}
              placeholder="Buscar por ID, estudiante, legajo o libro"
            />
          </BarraFiltros>
        </div>

        <div className="mt-3.5">
          <Tabs
            valor={estado}
            onChange={setEstado}
            opciones={[
              { id: "todas", etiqueta: "Todas", cantidad: contar("todas") },
              { id: "cobradas", etiqueta: "Cobradas", cantidad: contar("cobradas") },
              {
                id: "pendientes",
                etiqueta: "Pendientes",
                cantidad: contar("pendientes"),
              },
            ]}
          />
        </div>

        <Card padding={false} className="mt-4">
          <TablaDatos
            etiqueta="Sanciones del sistema"
            filas={filtradas}
            claveFila={(s) => s.id}
            vacio={
              <SinResultados
                titulo="No hay sanciones para mostrar"
                detalle={
                  q.trim()
                    ? "Ninguna sanción coincide con la búsqueda."
                    : "Las multas se generan al registrar una devolución con 8 días o más de atraso."
                }
              />
            }
            columnas={[
              {
                clave: "id",
                titulo: "ID",
                ancho: "110px",
                render: (s) => <Mono>{s.id}</Mono>,
              },
              {
                clave: "estudiante",
                titulo: "Estudiante",
                principal: true,
                render: (s) => (
                  <CeldaDoble
                    principal={s.estudiante.nombre}
                    detalle={`Legajo ${s.estudiante.legajo}`}
                  />
                ),
              },
              {
                clave: "libro",
                titulo: "Libro",
                render: (s) => s.libro.titulo,
              },
              {
                clave: "prestamo",
                titulo: "Préstamo",
                render: (s) => (
                  <BotonLink
                    href={`/admin/prestamos?q=${s.loanId}`}
                    variante="texto"
                    tamano="pill"
                  >
                    {s.loanId}
                  </BotonLink>
                ),
              },
              {
                clave: "limite",
                titulo: "Fecha límite",
                render: (s) => formatFecha(s.fechaLimiteOriginal),
              },
              {
                clave: "atraso",
                titulo: "Atraso",
                render: (s) => `${s.diasAtraso} d`,
              },
              {
                clave: "multa",
                titulo: "Multa",
                alinear: "derecha",
                render: (s) => (
                  <span className="font-semibold">{formatMonto(s.monto)}</span>
                ),
              },
              {
                clave: "estado",
                titulo: "Estado",
                alinear: "derecha",
                render: (s) => (
                  <div className="inline-flex flex-col items-end gap-1">
                    <EstadoSancionPill estado={s.estado} />
                    {s.fechaCobro && (
                      <span className="text-[11px] text-apagado">
                        {formatFecha(s.fechaCobro)}
                      </span>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </Card>
      </Contenido>
    </>
  );
}
