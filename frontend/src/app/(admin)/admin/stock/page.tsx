"use client";

import { useState } from "react";
import { Cabecera, Contenido } from "@/components/shell/Cabecera";
import { BotonLink } from "@/components/ui/Boton";
import { Aviso, Card, CardHeader, StatCard } from "@/components/ui/Card";
import { Buscador, Tabs } from "@/components/ui/Filtros";
import { Pill } from "@/components/ui/StatusPill";
import { Mono, SinResultados } from "@/components/ui/Tabla";
import { setCopyEstado } from "@/lib/api/books";
import { mensajeDeError } from "@/lib/api/errors";
import { nombreSede, SEDES } from "@/lib/domain/rules";
import type { Copy, EstadoEjemplar, SedeId } from "@/lib/domain/types";
import { useDb } from "@/lib/store/LibraryProvider";
import { indicadores } from "@/lib/store/selectors";

/* ---------------------------------------------------------------
   Pantalla 19: stock y ejemplares por sede.

   Inventario filtrable por sede con los contadores por estado y,
   para cada titulo, sus ejemplares fisicos individuales.
   --------------------------------------------------------------- */

type Filtro = SedeId | "todas";

/** Par fondo/texto de cada estado, igual que las pills del sistema. */
const ESTADO: Record<EstadoEjemplar, { etiqueta: string; clases: string }> = {
  disponible: { etiqueta: "Disponible", clases: "bg-ok-bg text-ok-fg" },
  prestado: { etiqueta: "Prestado", clases: "bg-alerta-bg text-alerta-fg" },
  reservado: { etiqueta: "Reservado", clases: "bg-aviso-bg text-secundario" },
  mantenimiento: { etiqueta: "En mantenimiento", clases: "bg-neutro-bg text-tenue" },
  baja: { etiqueta: "Dado de baja", clases: "bg-error-bg text-error-fg" },
};

export default function StockPorSede() {
  const db = useDb();
  const [sede, setSede] = useState<Filtro>(db.sedeActiva);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);

  const stats = indicadores(db, sede);
  const texto = q.trim().toLowerCase();

  // Un grupo por titulo que tenga al menos un ejemplar en la sede elegida.
  const grupos = db.libros
    .map((libro) => ({
      libro,
      ejemplares: db.ejemplares
        .filter((e) => e.isbn === libro.isbn && (sede === "todas" || e.sede === sede))
        .sort((a, b) => a.codigo.localeCompare(b.codigo)),
    }))
    .filter((grupo) => grupo.ejemplares.length > 0)
    .filter(
      (grupo) =>
        !texto ||
        grupo.libro.titulo.toLowerCase().includes(texto) ||
        grupo.libro.isbn.includes(texto) ||
        grupo.ejemplares.some((e) => e.codigo.toLowerCase().includes(texto)),
    );

  async function cambiarEstado(codigo: string, estado: EstadoEjemplar) {
    setError(null);
    try {
      await setCopyEstado(codigo, estado);
    } catch (e) {
      setError(mensajeDeError(e));
    }
  }

  return (
    <>
      <Cabecera
        migas={[{ etiqueta: "Biblioteca" }, { etiqueta: "Stock por sede" }]}
        titulo="Stock y ejemplares por sede"
      />

      <Contenido>
        <Tabs
          etiquetaGrupo="Filtrar por sede"
          valor={sede}
          onChange={setSede}
          opciones={[
            ...SEDES.map((s) => ({
              id: s.id as Filtro,
              etiqueta: `${s.nombre}${s.ciudad === "CABA" ? " (CABA)" : ""}`,
            })),
            { id: "todas" as Filtro, etiqueta: "Todas las sedes" },
          ]}
        />

        <div className="mt-4 grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-5">
          <StatCard label="Total" valor={stats.ejemplares} pie="Ejemplares físicos" />
          <StatCard
            label="Disponibles"
            valor={stats.disponibles}
            pie="Listos para prestar"
            tono="verde"
          />
          <StatCard label="Prestados" valor={stats.prestados} pie="Fuera de sede" />
          <StatCard label="Reservados" valor={stats.reservados} pie="Con reserva activa" />
          <StatCard
            label="Mantenimiento"
            valor={stats.mantenimiento}
            pie="Fuera de circulación"
          />
        </div>

        {error && (
          <div className="mt-4">
            <Aviso tono="error">{error}</Aviso>
          </div>
        )}

        <div className="mt-5 max-w-xl">
          <Buscador
            valor={q}
            onChange={setQ}
            placeholder="Buscar por título, ISBN o código de ejemplar"
          />
        </div>

        <Card padding={false} className="mt-4">
          <CardHeader
            titulo={
              <>
                Ejemplares físicos
                <span className="ml-2 font-normal text-apagado">
                  {sede === "todas" ? "todas las sedes" : nombreSede(sede)}
                </span>
              </>
            }
            accion={
              <span className="text-xs text-apagado">
                {grupos.length} {grupos.length === 1 ? "título" : "títulos"}
              </span>
            }
          />

          {grupos.length === 0 ? (
            <div className="px-5 py-10">
              <SinResultados
                titulo="No hay ejemplares en esta sede"
                detalle="Cambiá de sede o ingresá ejemplares desde la gestión de catálogo."
              />
            </div>
          ) : (
            <ul className="divide-y divide-borde-fino">
              {grupos.map(({ libro, ejemplares }) => (
                <li
                  key={libro.isbn}
                  className="grid gap-3 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,260px)_1fr] lg:gap-6"
                >
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold">{libro.titulo}</h3>
                    <p className="mt-0.5">
                      <Mono>{libro.isbn}</Mono>
                    </p>
                    {!libro.activo && (
                      <p className="mt-1.5">
                        <Pill tono="rojo">Título dado de baja</Pill>
                      </p>
                    )}
                  </div>

                  <ul className="flex flex-wrap gap-2">
                    {ejemplares.map((ejemplar) => (
                      <li key={ejemplar.codigo}>
                        <ChipEjemplar
                          ejemplar={ejemplar}
                          mostrarSede={sede === "todas"}
                          onCambiar={cambiarEstado}
                        />
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <p className="mt-4 text-xs text-apagado">
          Para ingresar ejemplares nuevos entrá a{" "}
          <BotonLink href="/admin/catalogo" variante="texto" tamano="pill">
            Gestión de catálogo
          </BotonLink>{" "}
          y elegí «Ejemplares» en el título.
        </p>
      </Contenido>
    </>
  );
}

/**
 * Ejemplar individual con su estado y, si no esta prestado, un selector para
 * moverlo entre estados. El mockup muestra el caso "Dado de baja / Reactivar";
 * el selector cubre el resto de las transiciones que la vista deja ver
 * (reservado y mantenimiento), que de otro modo quedarian sin forma de operar.
 */
function ChipEjemplar({
  ejemplar,
  mostrarSede,
  onCambiar,
}: {
  ejemplar: Copy;
  mostrarSede: boolean;
  onCambiar: (codigo: string, estado: EstadoEjemplar) => void;
}) {
  const { etiqueta, clases } = ESTADO[ejemplar.estado];
  const bloqueado = ejemplar.estado === "prestado";

  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-borde bg-white py-1 pl-3 pr-1">
      <span className="font-mono text-xs text-grafito">{ejemplar.codigo}</span>
      {mostrarSede && (
        <span className="text-[11px] text-apagado">
          {nombreSede(ejemplar.sede)}
        </span>
      )}
      {bloqueado ? (
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${clases}`}>
          {etiqueta}
        </span>
      ) : (
        <label>
          <span className="sr-only">Estado del ejemplar {ejemplar.codigo}</span>
          <select
            value={ejemplar.estado}
            onChange={(e) =>
              onCambiar(ejemplar.codigo, e.target.value as EstadoEjemplar)
            }
            className={`cursor-pointer appearance-none rounded-full px-2.5 py-1 text-[11px] font-semibold ${clases}`}
          >
            <option value="disponible">Disponible</option>
            <option value="reservado">Reservado</option>
            <option value="mantenimiento">En mantenimiento</option>
            <option value="baja">Dado de baja</option>
          </select>
        </label>
      )}
    </span>
  );
}
