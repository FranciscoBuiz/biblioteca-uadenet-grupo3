"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Cabecera, Contenido } from "@/components/shell/Cabecera";
import { Boton, BotonLink } from "@/components/ui/Boton";
import { Aviso, Card, CardHeader, StatCard } from "@/components/ui/Card";
import { Campo, CampoSelect } from "@/components/ui/Form";
import { EstadoEjemplarPill } from "@/components/ui/StatusPill";
import { Mono, SinResultados, TablaDatos } from "@/components/ui/Tabla";
import { addCopies, getBook, getCopies } from "@/lib/api/books";
import { SinDatos } from "@/components/ui/SinDatos";
import { useApi } from "@/lib/api/useApi";
import { useSedeActiva } from "@/lib/sedeActiva";
import { mensajeDeError } from "@/lib/api/errors";
import { nombreSede, SEDES, validarCantidad } from "@/lib/domain/rules";
import type { SedeId } from "@/lib/domain/types";

/* ---------------------------------------------------------------
   Pantalla 18: ejemplares del titulo.

   Resumen de totales, listado de los ejemplares fisicos con su
   codigo de inventario, sede y estado, y el bloque de ingreso de
   ejemplares nuevos.
   --------------------------------------------------------------- */

export default function EjemplaresDelTitulo() {
  const { isbn } = useParams<{ isbn: string }>();
  const sedeActiva = useSedeActiva();

  const { datos: libro, error: errorLibro, cargando } = useApi(() => getBook(isbn), [isbn]);
  const { datos: copias } = useApi(() => getCopies(isbn), [isbn]);
  const ejemplares = [...(copias ?? [])].sort((a, b) => a.codigo.localeCompare(b.codigo));

  const [sede, setSede] = useState<SedeId>(sedeActiva);
  const [cantidad, setCantidad] = useState("1");
  const [errorCantidad, setErrorCantidad] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  if (!libro && (cargando || errorLibro)) {
    return (
      <Contenido ancho="angosto">
        <SinDatos error={errorLibro} />
      </Contenido>
    );
  }

  if (!libro) {
    return (
      <>
        <Cabecera
          migas={[
            { etiqueta: "Biblioteca" },
            { etiqueta: "Catálogo", href: "/admin/catalogo" },
            { etiqueta: "Título no encontrado" },
          ]}
          titulo="Ejemplares del título"
        />
        <Contenido ancho="angosto">
          <Card>
            <SinResultados
              titulo="No encontramos ese título"
              detalle={`No hay ningún título con el ISBN ${isbn} en el catálogo.`}
            />
            <div className="mt-5 flex justify-center">
              <BotonLink href="/admin/catalogo" variante="neutro">
                Volver al catálogo
              </BotonLink>
            </div>
          </Card>
        </Contenido>
      </>
    );
  }

  async function agregar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setExito(null);

    const problema = validarCantidad(cantidad);
    setErrorCantidad(problema);
    if (problema) return;

    const total = Number(cantidad);
    setEnviando(true);
    try {
      const nuevos = await addCopies(isbn, sede, total);
      setExito(
        `Ingresaron ${nuevos.length} ${
          nuevos.length === 1 ? "ejemplar" : "ejemplares"
        } en ${nombreSede(sede)}: ${nuevos.map((e) => e.codigo).join(", ")}.`,
      );
      setCantidad("1");
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
          { etiqueta: "Catálogo", href: "/admin/catalogo" },
          { etiqueta: libro.titulo },
        ]}
        titulo="Ejemplares del título"
      />

      <Contenido ancho="angosto">
        <div>
          <h2 className="serif text-[22px]">{libro.titulo}</h2>
          <p className="mt-1 text-[13px] text-tenue">
            {libro.autor} · Cada ejemplar físico tiene su código de inventario,
            sede y estado.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <StatCard label="Total" valor={libro.totales} />
          <StatCard label="Disponibles" valor={libro.disponibles} tono="verde" />
          <StatCard label="Prestados" valor={libro.prestados} tono="azul" />
        </div>

        <div className="mt-4">
          <Card padding={false}>
            <TablaDatos
              etiqueta={`Ejemplares de ${libro.titulo}`}
              filas={ejemplares}
              claveFila={(ejemplar) => ejemplar.codigo}
              vacio={
                <SinResultados
                  titulo="Este título no tiene ejemplares"
                  detalle="Ingresá los primeros ejemplares con el formulario de abajo."
                />
              }
              columnas={[
                {
                  clave: "codigo",
                  titulo: "Código",
                  principal: true,
                  render: (ejemplar) => <Mono>{ejemplar.codigo}</Mono>,
                },
                {
                  clave: "sede",
                  titulo: "Sede",
                  render: (ejemplar) => nombreSede(ejemplar.sede),
                },
                {
                  clave: "estado",
                  titulo: "Estado",
                  render: (ejemplar) => (
                    <EstadoEjemplarPill estado={ejemplar.estado} />
                  ),
                },
              ]}
            />
          </Card>
        </div>

        <div className="mt-4">
          <Card padding={false}>
            <CardHeader titulo="Ingresar ejemplares" />
            <form onSubmit={agregar} className="p-5" noValidate>
              <div className="flex flex-col gap-3.5 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <CampoSelect
                    label="Sede"
                    value={sede}
                    onChange={(e) => setSede(e.target.value as SedeId)}
                    opciones={SEDES.map((s) => ({
                      valor: s.id,
                      etiqueta: `${s.nombre} (${s.ciudad})`,
                    }))}
                  />
                </div>
                <div className="sm:w-[140px]">
                  <Campo
                    label="Cantidad"
                    inputMode="numeric"
                    value={cantidad}
                    onChange={(e) => {
                      setCantidad(e.target.value);
                      if (errorCantidad) {
                        setErrorCantidad(validarCantidad(e.target.value));
                      }
                    }}
                    onBlur={() => setErrorCantidad(validarCantidad(cantidad))}
                    error={errorCantidad}
                    obligatorio
                  />
                </div>
                <div className="sm:pt-[26px]">
                  <Boton type="submit" variante="confirmar" cargando={enviando}>
                    Agregar ejemplares
                  </Boton>
                </div>
              </div>

              {exito && (
                <div className="mt-4">
                  <Aviso tono="ok">{exito}</Aviso>
                </div>
              )}
              {error && (
                <div className="mt-4">
                  <Aviso tono="error">{error}</Aviso>
                </div>
              )}
            </form>
          </Card>
        </div>

        <div className="mt-5">
          <BotonLink href="/admin/catalogo" variante="neutro">
            Volver al catálogo
          </BotonLink>
        </div>
      </Contenido>
    </>
  );
}
