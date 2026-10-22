"use client";

import { useParams } from "next/navigation";
import { Cabecera, Contenido } from "@/components/shell/Cabecera";
import { BotonNotificaciones } from "@/components/shell/PanelNotificaciones";
import { Boton, BotonLink } from "@/components/ui/Boton";
import { Card, Dato, Datos } from "@/components/ui/Card";
import { Mono, SinResultados } from "@/components/ui/Tabla";
import { SinDatos } from "@/components/ui/SinDatos";
import { getLoan } from "@/lib/api/loans";
import { useUsuarioActual } from "@/lib/api/sesion";
import { useApi } from "@/lib/api/useApi";
import { formatFecha, nombreSede } from "@/lib/domain/rules";

/* ---------------------------------------------------------------
   Pantalla 06: comprobante del prestamo recien generado.

   Es la pantalla a la que cae el estudiante despues de confirmar la
   solicitud: banda verde, datos del prestamo y el codigo que se
   presenta en el mostrador.
   --------------------------------------------------------------- */

const MIGAS = [
  { etiqueta: "Biblioteca" },
  { etiqueta: "Mis préstamos", href: "/prestamos" },
  { etiqueta: "Comprobante" },
];

export default function Comprobante() {
  const { id } = useParams<{ id: string }>();
  const usuario = useUsuarioActual();
  const { datos: prestamo, error, cargando } = useApi(() => getLoan(id), [id]);
  const estudiante = prestamo?.estudiante ?? usuario;

  if (!prestamo && (cargando || error)) {
    return (
      <Contenido ancho="angosto">
        <SinDatos error={error} />
      </Contenido>
    );
  }

  if (!prestamo) {
    return (
      <>
        <Cabecera migas={MIGAS} titulo="Comprobante de préstamo">
          <BotonNotificaciones />
        </Cabecera>

        <Contenido ancho="angosto">
          <Card padding={false} className="px-5 py-12">
            <SinResultados
              titulo="No encontramos ese comprobante"
              detalle={`No hay ningún préstamo registrado con el código ${id}.`}
            />
            <div className="mt-5 flex justify-center">
              <BotonLink href="/prestamos" variante="institucional" tamano="chico">
                Ir a Mis préstamos
              </BotonLink>
            </div>
          </Card>
        </Contenido>
      </>
    );
  }

  return (
    <>
      <Cabecera migas={MIGAS} titulo="Comprobante de préstamo">
        <BotonNotificaciones />
      </Cabecera>

      <Contenido ancho="angosto">
        <Card padding={false}>
          {/* Banda verde de confirmación */}
          <div className="bg-verde px-6 py-5 text-white">
            <p className="text-[11px] uppercase tracking-[1.6px] opacity-85">
              Comprobante digital
            </p>
            <h2 className="serif mt-1 text-[22px]">
              Préstamo generado correctamente
            </h2>
            <p className="mt-1.5 text-[13px] opacity-90">
              Presentá este código en el mostrador para retirar el libro.
            </p>
          </div>

          <div className="px-6 py-5">
            <div className="rounded-[12px] border border-borde-suave px-4">
              <Datos>
                <Dato label="Préstamo" destacado>
                  <Mono>{prestamo.id}</Mono>
                </Dato>
                <Dato label="Estudiante" destacado>
                  {estudiante.nombre}
                </Dato>
                <Dato label="Legajo" destacado>
                  <Mono>{estudiante.legajo}</Mono>
                </Dato>
                <Dato label="Libro" destacado>
                  {prestamo.libro.titulo}
                </Dato>
                <Dato label="Ejemplar" destacado>
                  <Mono>{prestamo.copia}</Mono>
                </Dato>
                <Dato label="Sede de retiro" destacado>
                  {nombreSede(prestamo.sede)}
                </Dato>
                <Dato label="Fecha límite" destacado>
                  {formatFecha(prestamo.fechaLimite)}
                </Dato>
              </Datos>
            </div>

            {/* Código de retiro: es el dato que mira el mostrador. */}
            <div className="mt-4 rounded-[12px] border border-aviso-borde bg-aviso-bg px-5 py-4 text-center">
              <p className="eyebrow">Código de retiro</p>
              <p className="serif mt-1.5 text-[30px] leading-none tracking-[0.14em] text-institucional">
                {prestamo.codigoRetiro}
              </p>
            </div>

            <div className="mt-5 flex flex-wrap gap-2.5">
              <BotonLink
                href="/prestamos"
                variante="institucional"
                tamano="chico"
              >
                Ir a Mis préstamos
              </BotonLink>
              {/* Sin backend no hay PDF que generar: lo honesto es ofrecer la
                  impresión del navegador, que también permite "Guardar como PDF". */}
              <Boton
                variante="neutro"
                tamano="chico"
                onClick={() => window.print()}
              >
                Descargar comprobante
              </Boton>
            </div>
          </div>
        </Card>
      </Contenido>
    </>
  );
}
