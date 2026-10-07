"use client";

import { useParams } from "next/navigation";
import { useState } from "react";
import { Cabecera, Contenido } from "@/components/shell/Cabecera";
import { BotonNotificaciones } from "@/components/shell/PanelNotificaciones";
import { Boton, BotonLink } from "@/components/ui/Boton";
import { Aviso, Card, Dato, Datos } from "@/components/ui/Card";
import { OpcionRadio } from "@/components/ui/Form";
import { Mono, SinResultados } from "@/components/ui/Tabla";
import { mensajeDeError } from "@/lib/api/errors";
import { METODOS_PAGO, payPenalty } from "@/lib/api/penalties";
import {
  enDias,
  formatFecha,
  formatMonto,
} from "@/lib/domain/rules";
import type {
  MetodoPago,
  PaymentReceipt,
  PenaltyView,
} from "@/lib/domain/types";
import { useDb, useUsuarioActual } from "@/lib/store/LibraryProvider";
import { sancionesDe } from "@/lib/store/selectors";

/* ---------------------------------------------------------------
   Pantallas 10 y 11: seleccion del medio de pago y comprobante.

   Las dos viven en la misma ruta y se alternan con estado local a
   proposito: el numero de operacion lo genera payPenalty y no queda
   guardado en la base, asi que una vez que navegas a otra pantalla
   ya no hay forma de recuperarlo. Separarlas en /pago y
   /pago/comprobante dejaria una URL que, al recargarla o
   compartirla, no podria mostrar el comprobante.
   --------------------------------------------------------------- */

function nombreMetodo(metodo: MetodoPago): string {
  return METODOS_PAGO.find((m) => m.id === metodo)?.nombre ?? metodo;
}

export default function PagoDeSancion() {
  const { id } = useParams<{ id: string }>();
  const db = useDb();
  const usuario = useUsuarioActual();

  const [metodo, setMetodo] = useState<MetodoPago>(METODOS_PAGO[0].id);
  const [comprobante, setComprobante] = useState<PaymentReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const sancion = sancionesDe(db, usuario.id).find((s) => s.id === id) ?? null;

  async function confirmar() {
    if (!sancion) return;
    setError(null);
    setEnviando(true);
    try {
      setComprobante(await payPenalty(sancion.id, metodo));
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
          { etiqueta: "Sanciones", href: "/sanciones" },
          { etiqueta: id, href: `/sanciones/${id}` },
          { etiqueta: comprobante ? "Comprobante" : "Pago" },
        ]}
        titulo={comprobante ? "Comprobante de pago" : "Pagar sanción"}
      >
        <BotonNotificaciones userId={usuario.id} />
      </Cabecera>

      <Contenido ancho="angosto">
        {!sancion ? (
          <Card>
            <SinResultados
              titulo="No encontramos esa sanción"
              detalle="Puede que el identificador esté mal escrito o que la sanción sea de otra cuenta."
            />
            <div className="mt-5 flex justify-center">
              <BotonLink href="/sanciones" variante="neutro" tamano="chico">
                Volver a mis sanciones
              </BotonLink>
            </div>
          </Card>
        ) : comprobante ? (
          <Comprobante comprobante={comprobante} />
        ) : sancion.estado === "cobrada" ? (
          <Card>
            <Aviso tono="ok" titulo="Esta multa ya está paga">
              La sanción {sancion.id} figura cobrada
              {sancion.fechaCobro
                ? ` desde el ${formatFecha(sancion.fechaCobro)}`
                : ""}
              , así que no hay nada por abonar.
            </Aviso>
            <div className="mt-4 flex flex-wrap gap-2.5">
              <BotonLink
                href={`/sanciones/${sancion.id}`}
                variante="neutro"
                tamano="chico"
              >
                Ver detalle de la sanción
              </BotonLink>
            </div>
          </Card>
        ) : (
          <Formulario
            sancion={sancion}
            metodo={metodo}
            onMetodo={setMetodo}
            error={error}
            enviando={enviando}
            onConfirmar={confirmar}
          />
        )}
      </Contenido>
    </>
  );
}

/** Paso 1 (mockup 10): resumen de la multa y eleccion del medio de pago. */
function Formulario({
  sancion,
  metodo,
  onMetodo,
  error,
  enviando,
  onConfirmar,
}: {
  sancion: PenaltyView;
  metodo: MetodoPago;
  onMetodo: (metodo: MetodoPago) => void;
  error: string | null;
  enviando: boolean;
  onConfirmar: () => void;
}) {
  return (
    <Card>
      <h2 className="serif text-xl sm:text-[23px]">Pagar sanción</h2>
      <p className="mt-1.5 text-[13px] text-tenue">
        Regularizá la multa para poder volver a solicitar préstamos.
      </p>

      <div className="mt-5 rounded-[12px] border border-borde-suave px-4">
        <Datos>
          <Dato label="Sanción" destacado>
            <Mono>{sancion.id}</Mono>
          </Dato>
          <Dato label="Libro" destacado>
            {sancion.libro.titulo}
          </Dato>
          <Dato label="Días de atraso" destacado>
            {enDias(sancion.diasAtraso)}
          </Dato>
          <Dato label="Total a pagar" destacado>
            <span className="text-[15px] font-bold text-rojo">
              {formatMonto(sancion.monto)}
            </span>
          </Dato>
        </Datos>
      </div>

      <fieldset className="mt-5">
        <legend className="eyebrow mb-2.5">Medio de pago</legend>
        <div className="flex flex-col gap-2">
          {METODOS_PAGO.map((opcion) => (
            <OpcionRadio
              key={opcion.id}
              nombre="metodo-pago"
              valor={opcion.id}
              seleccionado={metodo === opcion.id}
              onChange={(valor) => onMetodo(valor as MetodoPago)}
              titulo={opcion.nombre}
              detalle={opcion.detalle}
            />
          ))}
        </div>
      </fieldset>

      {error && (
        <div className="mt-4">
          <Aviso tono="error">{error}</Aviso>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2.5">
        <Boton
          variante="confirmar"
          tamano="chico"
          cargando={enviando}
          onClick={onConfirmar}
        >
          Confirmar pago
        </Boton>
        <BotonLink
          href={`/sanciones/${sancion.id}`}
          variante="neutro"
          tamano="chico"
        >
          Volver
        </BotonLink>
      </div>
    </Card>
  );
}

/** Paso 2 (mockup 11): comprobante con el numero de operacion. */
function Comprobante({ comprobante }: { comprobante: PaymentReceipt }) {
  return (
    <Card padding={false}>
      <div className="bg-verde px-5 py-5 text-white">
        <p className="text-[11px] font-semibold uppercase tracking-[1.6px] text-white/85">
          Comprobante de pago
        </p>
        <h2 className="serif mt-1 text-xl sm:text-[22px]">Pago registrado</h2>
        <p className="mt-1 text-[13px] text-white/90">
          La sanción quedó regularizada.
        </p>
      </div>

      <div className="px-5 py-4">
        <Datos>
          <Dato label="Nº de operación" destacado>
            <Mono>{comprobante.operacion}</Mono>
          </Dato>
          <Dato label="Fecha" destacado>
            {formatFecha(comprobante.fecha)}
          </Dato>
          <Dato label="Importe" destacado>
            <span className="text-[15px] font-bold">
              {formatMonto(comprobante.monto)}
            </span>
          </Dato>
          <Dato label="Medio de pago" destacado>
            {nombreMetodo(comprobante.metodo)}
          </Dato>
          <Dato label="Sanción" destacado>
            <Mono>{comprobante.penaltyId}</Mono>
          </Dato>
        </Datos>

        <div className="mt-4">
          <Aviso tono="ok">Ya podés volver a solicitar préstamos.</Aviso>
        </div>

        <div className="mt-4 flex flex-wrap gap-2.5">
          <BotonLink href="/catalogo" variante="avanzar" tamano="chico">
            Ir al catálogo
          </BotonLink>
          <BotonLink href="/sanciones" variante="neutro" tamano="chico">
            Ver mis sanciones
          </BotonLink>
        </div>
      </div>
    </Card>
  );
}
