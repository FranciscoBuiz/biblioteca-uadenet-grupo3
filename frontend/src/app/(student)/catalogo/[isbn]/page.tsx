"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Cabecera, Contenido } from "@/components/shell/Cabecera";
import { BotonNotificaciones } from "@/components/shell/PanelNotificaciones";
import { Boton, BotonLink } from "@/components/ui/Boton";
import { Aviso, Card, Dato, Datos } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { Portada } from "@/components/ui/Portada";
import { CategoriaPill, Disponibilidad, Pill } from "@/components/ui/StatusPill";
import { Mono, SinResultados } from "@/components/ui/Tabla";
import { getBook } from "@/lib/api/books";
import { createLoan } from "@/lib/api/loans";
import { useApi } from "@/lib/api/useApi";
import { mensajeDeError } from "@/lib/api/errors";
import {
  calcularFechaLimite,
  DIAS_PRESTAMO,
  DIAS_TOLERANCIA,
  formatFecha,
  HOY,
  nombreSede,
  SEDES,
} from "@/lib/domain/rules";
import type { SedeId } from "@/lib/domain/types";
import { useSedeActiva } from "@/lib/sedeActiva";

/* ---------------------------------------------------------------
   Pantallas 04 y 05: ficha del libro y modal de confirmacion.

   La sede de retiro se elige en la propia tabla de disponibilidad
   (los circulos del mockup son un grupo de radios), y es la que
   viaja a createLoan junto con el ISBN.
   --------------------------------------------------------------- */

/** Fila de la tabla "Disponibilidad por sede". */
interface FilaSede {
  sede: SedeId;
  nombre: string;
  ciudad: string;
  /** Domicilio de la sede; no todas lo tienen cargado. */
  direccion?: string;
  /** Ejemplares libres en la sede. */
  libres: number;
}

export default function DetalleLibro() {
  const { isbn } = useParams<{ isbn: string }>();
  const router = useRouter();
  const sedeActiva = useSedeActiva();
  const { datos: libro, error: errorCarga, cargando } = useApi(() => getBook(isbn), [isbn]);

  // El backend informa solo los ejemplares libres por sede (los totales
  // son un dato del bibliotecario), asi que la tabla muestra esos.
  const porSede: FilaSede[] = SEDES.map((s) => ({
    sede: s.id,
    nombre: s.nombre,
    ciudad: s.ciudad,
    direccion: s.direccion,
    libres: libro?.porSede[s.id] ?? 0,
  }));

  // Arrancamos en la sede del header hasta que el usuario elija otra.
  const [sede, setSede] = useState<SedeId | null>(null);

  const [abierto, setAbierto] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const sedeElegida = sede ?? sedeActiva;

  const libres = porSede.find((f) => f.sede === sedeElegida)?.libres ?? 0;

  if (!libro) {
    if (cargando) {
      return (
        <Contenido>
          <p className="text-[13px] text-tenue" role="status">
            Cargando…
          </p>
        </Contenido>
      );
    }
    return (
      <>
        <Cabecera
          migas={[
            { etiqueta: "Biblioteca" },
            { etiqueta: "Catálogo", href: "/catalogo" },
            { etiqueta: "Título no encontrado" },
          ]}
          titulo="Detalle del libro"
        >
          <BotonNotificaciones />
        </Cabecera>

        <Contenido ancho="angosto">
          <Card padding={false} className="px-5 py-12">
            {errorCarga ? (
              <Aviso tono="error">{errorCarga}</Aviso>
            ) : (
              <SinResultados
                titulo="No encontramos ese título"
                detalle={`No hay ningún libro con el ISBN ${isbn} en el catálogo.`}
              />
            )}
            <div className="mt-5 flex justify-center">
              <BotonLink href="/catalogo" variante="avanzar" tamano="chico">
                Volver al catálogo
              </BotonLink>
            </div>
          </Card>
        </Contenido>
      </>
    );
  }

  function abrirModal() {
    setError(null);
    setAbierto(true);
  }

  function cerrarModal() {
    // Mientras la solicitud viaja no dejamos cerrar, para no perder el aviso.
    if (enviando) return;
    setAbierto(false);
  }

  async function solicitar() {
    setError(null);
    setEnviando(true);

    try {
      const prestamo = await createLoan(isbn, sedeElegida);
      router.push(`/comprobante/${prestamo.id}`);
    } catch (e) {
      // El modal queda abierto con el motivo (sanción pendiente, sin stock...).
      setError(mensajeDeError(e));
      setEnviando(false);
    }
  }

  return (
    <>
      <Cabecera
        migas={[
          { etiqueta: "Biblioteca" },
          { etiqueta: "Catálogo", href: "/catalogo" },
          { etiqueta: libro.titulo },
        ]}
        titulo="Detalle del libro"
      >
        <BotonNotificaciones />
      </Cabecera>

      <Contenido>
        <div className="grid gap-5 lg:grid-cols-[250px_1fr] lg:items-start lg:gap-6">
          <Card className="flex justify-center">
            <Portada titulo={libro.titulo} tamano="lg" mostrarTitulo isbn={libro.isbn} />
          </Card>

          <div className="min-w-0">
            <h2 className="serif text-[26px] leading-tight sm:text-[32px]">
              {libro.titulo}
            </h2>
            <p className="mt-1.5 text-[15px] text-tenue">
              {libro.autor} · {libro.editorial} · {libro.anio}
            </p>

            <div className="mt-3.5 flex flex-wrap items-center gap-2">
              <CategoriaPill>{libro.categoria}</CategoriaPill>
              <Pill tono="gris">
                <Mono>ISBN {libro.isbn}</Mono>
              </Pill>
              <span className="inline-flex items-center gap-1 rounded-full bg-neutro-bg px-3 py-1">
                <Disponibilidad cantidad={libres} />
                <span className="text-xs font-semibold text-tenue">
                  en {nombreSede(sedeElegida)}
                </span>
              </span>
            </div>

            <p className="mt-4 max-w-[620px] text-sm leading-relaxed text-grafito">
              {libro.descripcion}
            </p>

            {/* Disponibilidad por sede: también elige la sede de retiro. */}
            <Card padding={false} className="mt-5">
              <h3
                id="titulo-sedes"
                className="border-b border-borde-suave px-[18px] py-3.5 text-sm font-semibold"
              >
                Disponibilidad por sede
              </h3>

              <div role="radiogroup" aria-labelledby="titulo-sedes">
                {porSede.length === 0 ? (
                  <p className="px-[18px] py-4 text-[13px] text-tenue">
                    Este título todavía no tiene ejemplares cargados en ninguna
                    sede.
                  </p>
                ) : (
                  porSede.map((fila) => {
                    const elegida = fila.sede === sedeElegida;
                    return (
                      <label
                        key={fila.sede}
                        className={[
                          "flex cursor-pointer flex-wrap items-center gap-3.5 border-b border-borde-fino px-[18px] py-3.5 last:border-b-0",
                          elegida ? "bg-aviso-bg" : "",
                        ].join(" ")}
                      >
                        <input
                          type="radio"
                          name="sede-retiro"
                          value={fila.sede}
                          checked={elegida}
                          onChange={() => setSede(fila.sede)}
                          className="size-4 shrink-0 accent-secundario"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">
                            {fila.nombre} ({fila.ciudad})
                          </span>
                          <span className="block text-xs text-tenue">
                            {fila.direccion ?? "Retiro presencial"}
                          </span>
                        </span>
                        <span className="text-xs text-tenue">
                          {fila.libres}{" "}
                          {fila.libres === 1 ? "ejemplar libre" : "ejemplares libres"}
                        </span>
                        <Pill tono={fila.libres > 0 ? "verde" : "gris"}>
                          {fila.libres > 0 ? "Disponible" : "Sin stock"}
                        </Pill>
                      </label>
                    );
                  })
                )}
              </div>
            </Card>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Boton
                variante="confirmar"
                onClick={abrirModal}
                disabled={libres === 0}
              >
                Solicitar préstamo
              </Boton>
              <BotonLink href="/catalogo" variante="neutro">
                Volver al catálogo
              </BotonLink>
              <p className="text-xs text-apagado">
                Retiro presencial en la sede seleccionada · {DIAS_PRESTAMO} días
                de préstamo
              </p>
            </div>
          </div>
        </div>
      </Contenido>

      {/* Pantalla 05 */}
      <Modal
        abierto={abierto}
        onCerrar={cerrarModal}
        titulo="Confirmá tu solicitud"
        bajada="Se reserva un ejemplar físico a tu nombre para retirar en la sede elegida."
        acciones={
          <>
            <Boton
              variante="confirmar"
              onClick={solicitar}
              cargando={enviando}
            >
              Confirmar préstamo
            </Boton>
            <Boton variante="neutro" onClick={cerrarModal} disabled={enviando}>
              Cancelar
            </Boton>
          </>
        }
      >
        <div className="rounded-[12px] border border-borde-suave px-4">
          <Datos>
            <Dato label="Libro" destacado>
              {libro.titulo}
            </Dato>
            <Dato label="Autor" destacado>
              {libro.autor}
            </Dato>
            <Dato label="Sede de retiro" destacado>
              {nombreSede(sedeElegida)}
            </Dato>
            <Dato label="Fecha de solicitud" destacado>
              {formatFecha(HOY)}
            </Dato>
            <Dato label="Fecha límite de devolución" destacado>
              {formatFecha(calcularFechaLimite(HOY))}
            </Dato>
          </Datos>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <Aviso tono="alerta">
            Pasados {DIAS_TOLERANCIA} días de la fecha límite sin devolver el
            libro se aplica una sanción y una multa sobre tu saldo
            institucional.
          </Aviso>

          {error && <Aviso tono="error">{error}</Aviso>}
        </div>
      </Modal>
    </>
  );
}
