"use client";

import { useState } from "react";
import { Cabecera, Contenido } from "@/components/shell/Cabecera";
import { BotonNotificaciones } from "@/components/shell/PanelNotificaciones";
import { BotonLink } from "@/components/ui/Boton";
import { Aviso, Card } from "@/components/ui/Card";
import {
  BarraFiltros,
  Buscador,
  Chips,
  SelectPill,
  Toggle,
  type Opcion,
} from "@/components/ui/Filtros";
import { Portada } from "@/components/ui/Portada";
import { CategoriaPill, Disponibilidad } from "@/components/ui/StatusPill";
import { Mono, SinResultados } from "@/components/ui/Tabla";
import { getBooks, getCategorias } from "@/lib/api/books";
import { useApi } from "@/lib/api/useApi";
import { nombreSede, SEDES } from "@/lib/domain/rules";
import type { SedeId } from "@/lib/domain/types";
import { useSedeActiva } from "@/lib/sedeActiva";

/* ---------------------------------------------------------------
   Pantalla 03: catalogo de libros.

   Los filtros viajan al backend (GET /books); el catalogo se vuelve
   a pedir cada vez que cambian.
   --------------------------------------------------------------- */

type Orden = "recientes" | "titulo" | "disponibilidad";

const ORDENES: Opcion<Orden>[] = [
  { id: "recientes", etiqueta: "Más recientes" },
  { id: "titulo", etiqueta: "Título" },
  { id: "disponibilidad", etiqueta: "Disponibilidad" },
];

export default function Catalogo() {
  const sedeActiva = useSedeActiva();

  const [texto, setTexto] = useState("");
  const [sede, setSede] = useState<SedeId>(sedeActiva);
  const [soloStock, setSoloStock] = useState(false);
  const [categoria, setCategoria] = useState("todas");
  const [orden, setOrden] = useState<Orden>("recientes");

  const opcionesSede: Opcion<SedeId>[] = SEDES.map((s) => ({
    id: s.id,
    etiqueta: s.nombre,
  }));

  const { datos: categorias } = useApi(() => getCategorias(), []);
  const opcionesCategoria: Opcion<string>[] = [
    { id: "todas", etiqueta: "Todas" },
    ...(categorias ?? []).map((c) => ({ id: c, etiqueta: c })),
  ];

  const { datos, error } = useApi(
    () =>
      getBooks({
        q: texto,
        sede,
        categoria: categoria === "todas" ? undefined : categoria,
        soloStock,
        orden,
      }),
    [texto, sede, categoria, soloStock, orden],
  );
  const resultados = datos ?? [];

  return (
    <>
      <Cabecera
        migas={[{ etiqueta: "Biblioteca" }, { etiqueta: "Catálogo" }]}
        titulo="Catálogo de libros"
      >
        <BotonNotificaciones />
      </Cabecera>

      <Contenido>
        <Card>
          <BarraFiltros>
            <Buscador
              valor={texto}
              onChange={setTexto}
              placeholder="Buscar por título, autor o ISBN"
              etiqueta="Buscar en el catálogo"
            />
            <SelectPill
              etiqueta="Sede"
              valor={sede}
              opciones={opcionesSede}
              onChange={setSede}
            />
            <Toggle activo={soloStock} onChange={setSoloStock}>
              Solo con stock
            </Toggle>
          </BarraFiltros>

          <div className="mt-3.5">
            <Chips
              opciones={opcionesCategoria}
              valor={categoria}
              onChange={setCategoria}
            />
          </div>
        </Card>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[13px] text-tenue">
            {resultados.length}{" "}
            {resultados.length === 1 ? "título" : "títulos"} en{" "}
            {nombreSede(sede)}
          </p>
          <SelectPill
            etiqueta="Ordenar por"
            valor={orden}
            opciones={ORDENES}
            onChange={setOrden}
          />
        </div>

        {error ? (
          <div className="mt-3.5">
            <Aviso tono="error">{error}</Aviso>
          </div>
        ) : !datos ? (
          <p className="mt-3.5 text-[13px] text-tenue" role="status">
            Cargando…
          </p>
        ) : resultados.length === 0 ? (
          <Card padding={false} className="mt-3.5 px-5 py-10">
            <SinResultados
              titulo="No encontramos títulos con esos filtros"
              detalle="Probá con otro término de búsqueda, cambiá de sede o sacá el filtro de stock."
            />
          </Card>
        ) : (
          <ul className="mt-3.5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {resultados.map((libro) => (
              <li key={libro.isbn}>
                <Card padding={false} className="flex h-full flex-col p-3.5">
                  <Portada titulo={libro.titulo} tamano="md" mostrarTitulo isbn={libro.isbn} />

                  <h2 className="mt-2.5 text-sm font-semibold">
                    {libro.titulo}
                  </h2>
                  <p className="text-xs text-tenue">{libro.autor}</p>
                  <p className="mt-0.5">
                    <Mono>ISBN {libro.isbn}</Mono>
                  </p>

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <CategoriaPill>{libro.categoria}</CategoriaPill>
                    <Disponibilidad cantidad={libro.porSede[sede]} />
                  </div>

                  <div className="mt-auto pt-2.5">
                    <BotonLink
                      href={`/catalogo/${libro.isbn}`}
                      variante="contorno"
                      tamano="chico"
                      ancho
                    >
                      Ver detalle
                    </BotonLink>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </Contenido>
    </>
  );
}
