"use client";

import { useState } from "react";
import { Cabecera, Contenido } from "@/components/shell/Cabecera";
import { Boton, BotonLink } from "@/components/ui/Boton";
import { Aviso, Card } from "@/components/ui/Card";
import { BarraFiltros, Buscador, SelectPill } from "@/components/ui/Filtros";
import { Modal } from "@/components/ui/Modal";
import { CategoriaPill, Pill } from "@/components/ui/StatusPill";
import { Mono, SinResultados, TablaDatos } from "@/components/ui/Tabla";
import { getBooks, setBookActivo } from "@/lib/api/books";
import { SinDatos } from "@/components/ui/SinDatos";
import { useApi } from "@/lib/api/useApi";
import { mensajeDeError } from "@/lib/api/errors";
import { SEDES } from "@/lib/domain/rules";
import type { BookWithStock, SedeId } from "@/lib/domain/types";

/* ---------------------------------------------------------------
   Pantalla 15: gestion de catalogo.

   Lista todos los titulos, incluidos los dados de baja (el mockup
   los muestra atenuados con la accion "Reactivar"), con los
   contadores de ejemplares y las acciones de edicion.
   --------------------------------------------------------------- */

type FiltroSede = SedeId | "todas";

export default function GestionCatalogo() {
  const [q, setQ] = useState("");
  const [sede, setSede] = useState<FiltroSede>("todas");
  const [error, setError] = useState<string | null>(null);
  const [aConfirmar, setAConfirmar] = useState<BookWithStock | null>(null);
  const [procesando, setProcesando] = useState<string | null>(null);

  // Se listan tambien los titulos inactivos: esta pantalla es la que
  // permite reactivarlos.
  const { datos, error: errorCarga } = useApi(
    () => getBooks({ q, incluirInactivos: true }),
    [q],
  );
  // El backend no filtra titulos por sede (solo cuenta stock), asi que se
  // acota aca a los que tienen ejemplares libres en la sede elegida.
  const libros = (datos ?? []).filter((l) => sede === "todas" || l.porSede[sede] > 0);

  /** Baja logica del titulo, una vez confirmada en el modal. */
  async function darDeBaja(libro: BookWithStock) {
    setError(null);
    setProcesando(libro.isbn);
    try {
      await setBookActivo(libro.isbn, false);
      setAConfirmar(null);
    } catch (e) {
      setError(mensajeDeError(e));
      setAConfirmar(null);
    } finally {
      setProcesando(null);
    }
  }

  async function reactivar(libro: BookWithStock) {
    setError(null);
    setProcesando(libro.isbn);
    try {
      await setBookActivo(libro.isbn, true);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setProcesando(null);
    }
  }

  return (
    <>
      <Cabecera
        migas={[{ etiqueta: "Biblioteca" }, { etiqueta: "Catálogo" }]}
        titulo="Gestión de catálogo"
      />

      <Contenido>
        <BarraFiltros>
          <Buscador
            valor={q}
            onChange={setQ}
            placeholder="Buscar por título, autor o ISBN"
          />
          <SelectPill<FiltroSede>
            etiqueta="Sede"
            valor={sede}
            onChange={setSede}
            opciones={[
              { id: "todas", etiqueta: "Todas" },
              ...SEDES.map((s) => ({ id: s.id as FiltroSede, etiqueta: s.nombre })),
            ]}
          />
          <BotonLink
            href="/admin/catalogo/nuevo"
            tamano="pill"
            variante="confirmar"
          >
            Nuevo libro
          </BotonLink>
        </BarraFiltros>

        {error && (
          <div className="mt-4">
            <Aviso tono="error">{error}</Aviso>
          </div>
        )}

        <div className="mt-4">
          {!datos ? (
            <SinDatos error={errorCarga} />
          ) : (
          <Card padding={false}>
            <TablaDatos
              etiqueta="Títulos del catálogo"
              filas={libros}
              claveFila={(libro) => libro.isbn}
              vacio={
                <SinResultados
                  titulo="No encontramos títulos"
                  detalle="Probá con otro término de búsqueda o cambiá la sede."
                />
              }
              columnas={[
                {
                  clave: "isbn",
                  titulo: "ISBN",
                  render: (libro) => <Mono>{libro.isbn}</Mono>,
                },
                {
                  clave: "titulo",
                  titulo: "Título",
                  principal: true,
                  render: (libro) => libro.titulo,
                },
                {
                  clave: "autor",
                  titulo: "Autor",
                  render: (libro) => (
                    <span className="text-grafito">{libro.autor}</span>
                  ),
                },
                {
                  clave: "categoria",
                  titulo: "Categoría",
                  render: (libro) => (
                    <CategoriaPill>{libro.categoria}</CategoriaPill>
                  ),
                },
                {
                  clave: "total",
                  titulo: "Total",
                  render: (libro) => (
                    <span className="font-semibold">{libro.totales}</span>
                  ),
                },
                {
                  clave: "disponibles",
                  titulo: "Disp.",
                  render: (libro) => (
                    <span className="font-semibold text-verde">
                      {libro.disponibles}
                    </span>
                  ),
                },
                {
                  clave: "prestados",
                  titulo: "Prest.",
                  render: (libro) => (
                    <span className="font-semibold text-secundario">
                      {libro.prestados}
                    </span>
                  ),
                },
                {
                  clave: "acciones",
                  titulo: "Acciones",
                  accion: true,
                  alinear: "derecha",
                  render: (libro) =>
                    libro.activo ? (
                      <div className="flex flex-wrap justify-end gap-1.5">
                        <BotonLink
                          href={`/admin/catalogo/${libro.isbn}/editar`}
                          tamano="pill"
                        >
                          Editar
                        </BotonLink>
                        <BotonLink
                          href={`/admin/catalogo/${libro.isbn}/ejemplares`}
                          tamano="pill"
                        >
                          Ejemplares
                        </BotonLink>
                        <Boton
                          variante="peligro"
                          tamano="pill"
                          onClick={() => setAConfirmar(libro)}
                        >
                          Baja
                        </Boton>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-end gap-1.5">
                        <Pill tono="rojo">Dado de baja</Pill>
                        <Boton
                          variante="neutro"
                          tamano="pill"
                          cargando={procesando === libro.isbn}
                          onClick={() => reactivar(libro)}
                        >
                          Reactivar
                        </Boton>
                      </div>
                    ),
                },
              ]}
            />
          </Card>
          )}
        </div>
      </Contenido>

      <Modal
        abierto={aConfirmar !== null}
        onCerrar={() => setAConfirmar(null)}
        titulo="Dar de baja el título"
        bajada={
          aConfirmar
            ? `${aConfirmar.titulo} deja de aparecer en el catálogo del estudiante.`
            : undefined
        }
        acciones={
          <>
            <Boton
              variante="peligro"
              cargando={procesando !== null}
              onClick={() => aConfirmar && darDeBaja(aConfirmar)}
            >
              Dar de baja
            </Boton>
            <Boton variante="neutro" onClick={() => setAConfirmar(null)}>
              Cancelar
            </Boton>
          </>
        }
      >
        <Aviso tono="alerta">
          La baja es lógica: los ejemplares físicos se conservan y el título se
          puede reactivar desde esta misma pantalla. No se puede dar de baja un
          título con ejemplares prestados sin devolver.
        </Aviso>
      </Modal>
    </>
  );
}
