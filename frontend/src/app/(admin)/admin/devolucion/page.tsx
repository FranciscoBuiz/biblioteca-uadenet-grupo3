"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { Cabecera, Contenido } from "@/components/shell/Cabecera";
import { Boton, BotonLink } from "@/components/ui/Boton";
import { Aviso, Card, Dato, Datos } from "@/components/ui/Card";
import { Campo } from "@/components/ui/Form";
import { EstadoPrestamoPill } from "@/components/ui/StatusPill";
import { Mono, SinResultados } from "@/components/ui/Tabla";
import { mensajeDeError } from "@/lib/api/errors";
import { SinDatos } from "@/components/ui/SinDatos";
import { getLoans, returnLoan } from "@/lib/api/loans";
import { useApi } from "@/lib/api/useApi";
import {
  DIAS_PARA_SANCION,
  enDias,
  formatFecha,
  formatMonto,
  MONTO_MULTA,
  nombreSede,
} from "@/lib/domain/rules";
import type { LoanView, Penalty } from "@/lib/domain/types";

/* ---------------------------------------------------------------
   Pantalla 21: mostrador de devolucion fisica.

   Flujo presencial: el bibliotecario busca por DNI, legajo, ID de
   prestamo o codigo de comprobante, elige cual de los prestamos
   activos se esta devolviendo y confirma la recepcion. Al confirmar
   se libera el ejemplar y, si el atraso llego al dia 8, el sistema
   genera la sancion.
   --------------------------------------------------------------- */

export default function MostradorDevolucion() {
  return (
    <>
      <Cabecera
        migas={[{ etiqueta: "Biblioteca" }, { etiqueta: "Devoluciones" }]}
        titulo="Mostrador de devolución física"
      />
      {/* useSearchParams necesita un limite de Suspense durante el prerender. */}
      <Suspense fallback={<Contenido>Cargando…</Contenido>}>
        <Mostrador />
      </Suspense>
    </>
  );
}

interface Registrada {
  prestamo: LoanView;
  sancion: Penalty | null;
}

function Mostrador() {
  const searchParams = useSearchParams();

  // El panel del bibliotecario linkea acá con ?q={id del préstamo}.
  const [q, setQ] = useState(searchParams.get("q") ?? "");
  const [seleccionado, setSeleccionado] = useState<string | null>(null);
  const [registrada, setRegistrada] = useState<Registrada | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);

  const texto = q.trim();

  // Sin dato ingresado no se lista nada: es un mostrador, no un listado.
  const busqueda = useApi(
    () => (texto ? getLoans({ q: texto, estado: "activos" }) : Promise.resolve([])),
    [texto],
  );
  const resultados = busqueda.datos ?? [];

  const elegido = resultados.find((p) => p.id === seleccionado) ?? null;

  async function confirmar(prestamo: LoanView) {
    setError(null);
    setConfirmando(true);
    try {
      const { sancion } = await returnLoan(prestamo.id);
      setRegistrada({ prestamo, sancion });
      setSeleccionado(null);
    } catch (e) {
      setError(mensajeDeError(e));
    } finally {
      setConfirmando(false);
    }
  }

  return (
    <Contenido>
      {registrada && (
        <div className="mb-5">
          <ConfirmacionDevolucion
            registrada={registrada}
            onCerrar={() => setRegistrada(null)}
          />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        {/* Búsqueda y resultados */}
        <Card>
          <h2 className="serif text-lg">Buscar préstamo</h2>
          <p className="mt-1 text-[13px] text-tenue">
            Ingresá el DNI o legajo del estudiante, el ID del préstamo o el
            código del comprobante.
          </p>

          <div className="mt-4">
            <Campo
              label="DNI, legajo, ID de préstamo o comprobante"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setSeleccionado(null);
              }}
              placeholder="41.222.333"
              autoFocus
            />
          </div>

          <div className="mt-4">
            {!texto ? (
              <p className="py-6 text-center text-[13px] text-apagado">
                Escribí un dato del estudiante o del préstamo para empezar.
              </p>
            ) : !busqueda.datos ? (
              <SinDatos error={busqueda.error} />
            ) : resultados.length === 0 ? (
              <SinResultados
                titulo="Sin préstamos activos"
                detalle="No encontramos préstamos sin devolver que coincidan con ese dato."
              />
            ) : (
              <>
                <p className="eyebrow mb-2">
                  {resultados.length}{" "}
                  {resultados.length === 1
                    ? "préstamo activo"
                    : "préstamos activos"}
                </p>
                <ul className="flex flex-col gap-2">
                  {resultados.map((prestamo) => {
                    const activo = prestamo.id === seleccionado;

                    return (
                      <li key={prestamo.id}>
                        <button
                          type="button"
                          onClick={() => setSeleccionado(prestamo.id)}
                          aria-pressed={activo}
                          className={[
                            "flex w-full items-center gap-3 rounded-[11px] border px-3.5 py-3 text-left transition-colors",
                            activo
                              ? "border-secundario bg-aviso-bg"
                              : "border-borde-fuerte bg-white hover:border-secundario",
                          ].join(" ")}
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">
                              {prestamo.libro.titulo}
                            </span>
                            <span className="mt-0.5 block truncate text-xs text-tenue">
                              {prestamo.estudiante.nombre} · {prestamo.id} ·{" "}
                              {nombreSede(prestamo.sede)}
                            </span>
                          </span>
                          <EstadoPrestamoPill estado={prestamo.estado} />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </Card>

        {/* Panel de confirmación */}
        {elegido ? (
          <PanelConfirmacion
            prestamo={elegido}
            error={error}
            confirmando={confirmando}
            onConfirmar={() => confirmar(elegido)}
            onCancelar={() => setSeleccionado(null)}
          />
        ) : (
          <Card>
            <h2 className="serif text-lg">Confirmar recepción física</h2>
            <p className="mt-1 text-[13px] text-tenue">
              Elegí un préstamo de la lista para ver sus datos y registrar la
              devolución.
            </p>
            <div className="mt-6 rounded-[11px] border border-dashed border-borde-fuerte px-4 py-10 text-center">
              <p className="text-[13px] text-apagado">
                Ningún préstamo seleccionado.
              </p>
            </div>
          </Card>
        )}
      </div>
    </Contenido>
  );
}

function PanelConfirmacion({
  prestamo,
  error,
  confirmando,
  onConfirmar,
  onCancelar,
}: {
  prestamo: LoanView;
  error: string | null;
  confirmando: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}) {
  const atraso = prestamo.diasAtraso;
  const generaSancion = atraso >= DIAS_PARA_SANCION && !prestamo.sancion;

  return (
    <Card>
      <h2 className="serif text-lg">Confirmar recepción física</h2>

      <Datos>
        <Dato label="Préstamo">
          <Mono>{prestamo.id}</Mono>
        </Dato>
        <Dato label="Estudiante">
          {prestamo.estudiante.nombre} · {prestamo.estudiante.legajo}
        </Dato>
        <Dato label="DNI">{prestamo.estudiante.dni}</Dato>
        <Dato label="Libro">{prestamo.libro.titulo}</Dato>
        <Dato label="Ejemplar">
          <Mono>{prestamo.copia}</Mono>
        </Dato>
        <Dato label="Sede">{nombreSede(prestamo.sede)}</Dato>
        <Dato label="Fecha límite">{formatFecha(prestamo.fechaLimite)}</Dato>
        <Dato label="Situación" destacado>
          {atraso > 0 ? `Con retraso · ${enDias(atraso)}` : "En plazo"}
        </Dato>
      </Datos>

      <div className="mt-4">
        {atraso === 0 ? (
          <Aviso tono="ok">
            La devolución está en plazo. No corresponde ninguna sanción.
          </Aviso>
        ) : generaSancion ? (
          <Aviso tono="error">
            Devolución con {atraso} días de atraso. Al confirmar se genera una
            sanción con una multa de {formatMonto(MONTO_MULTA)} sobre el saldo
            institucional del estudiante.
          </Aviso>
        ) : prestamo.sancion ? (
          <Aviso tono="alerta">
            Este préstamo ya tiene la sanción {prestamo.sancion.id} aplicada. Al
            confirmar se cierra el préstamo, pero la multa sigue su curso.
          </Aviso>
        ) : (
          <Aviso tono="alerta">
            Devolución con retraso de {enDias(atraso)}. Todavía no corresponde
            sanción: se aplica a partir del día {DIAS_PARA_SANCION} de atraso.
          </Aviso>
        )}
      </div>

      {error && (
        <div className="mt-3">
          <Aviso tono="error">{error}</Aviso>
        </div>
      )}

      <div className="mt-5 flex flex-wrap gap-2.5">
        <Boton onClick={onConfirmar} cargando={confirmando}>
          Confirmar recepción física
        </Boton>
        <Boton variante="neutro" onClick={onCancelar} disabled={confirmando}>
          Cancelar
        </Boton>
      </div>
    </Card>
  );
}

function ConfirmacionDevolucion({
  registrada,
  onCerrar,
}: {
  registrada: Registrada;
  onCerrar: () => void;
}) {
  const { prestamo, sancion } = registrada;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-verde">
            Devolución registrada
          </p>
          <p className="mt-1 text-[13px] text-tenue">
            {prestamo.libro.titulo} vuelve al stock disponible de{" "}
            {nombreSede(prestamo.sede)}. El préstamo {prestamo.id} quedó cerrado.
          </p>
        </div>
        <Boton variante="texto" tamano="pill" onClick={onCerrar}>
          Cerrar
        </Boton>
      </div>

      {sancion && (
        <div className="mt-3.5">
          <Aviso tono="error" titulo={`Se generó la sanción ${sancion.id}`}>
            {enDias(sancion.diasAtraso)} de atraso · multa de{" "}
            {formatMonto(sancion.monto)}.{" "}
            <Link
              href={`/admin/sanciones?q=${sancion.id}`}
              className="font-semibold underline"
            >
              Ver en sanciones
            </Link>
          </Aviso>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2.5">
        <BotonLink href="/admin/prestamos" tamano="pill">
          Ir a gestión de préstamos
        </BotonLink>
        <BotonLink href="/admin/stock" tamano="pill">
          Ver stock por sede
        </BotonLink>
      </div>
    </Card>
  );
}
