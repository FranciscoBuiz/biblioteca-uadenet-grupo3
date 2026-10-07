"use client";

import Link from "next/link";
import { Cabecera, Contenido } from "@/components/shell/Cabecera";
import {
  BotonNotificaciones,
  FilaNotificacion,
} from "@/components/shell/PanelNotificaciones";
import { Card, CardHeader, Hero, StatCard } from "@/components/ui/Card";
import { Portada } from "@/components/ui/Portada";
import { EstadoPrestamoPill } from "@/components/ui/StatusPill";
import { SinResultados } from "@/components/ui/Tabla";
import { formatFecha, nombreSede } from "@/lib/domain/rules";
import type { LoanView } from "@/lib/domain/types";
import type { Db } from "@/lib/store/db";
import { useDb, useUsuarioActual } from "@/lib/store/LibraryProvider";
import {
  notificacionesDe,
  prestamosDe,
  sancionesDe,
} from "@/lib/store/selectors";

/* ---------------------------------------------------------------
   Pantalla 02: inicio del estudiante.

   Hero con el resumen de la situacion, tres indicadores, la lista
   de prestamos en curso y, a la derecha, avisos y la proxima
   devolucion. Todos los numeros salen de los selectores.
   --------------------------------------------------------------- */

export default function InicioEstudiante() {
  const usuario = useUsuarioActual();
  const db = useDb();

  const mis = prestamosDe(db, usuario.id);
  const activos = mis.filter((p) => !p.fechaDevolucion);
  const vencidos = activos.filter((p) => p.diasAtraso > 0);
  const misSanciones = sancionesDe(db, usuario.id);
  const pendientes = misSanciones.filter((s) => s.estado === "pendiente");

  // La lista del mockup esta ordenada por cercania del vencimiento.
  const enCurso = [...activos].sort((a, b) =>
    a.fechaLimite.localeCompare(b.fechaLimite),
  );

  // "Mas proximo" es el primero que todavia esta en plazo.
  const proxima = enCurso.find((p) => p.diasAtraso === 0);

  const avisos = elegirAvisos(db, usuario.id);

  return (
    <>
      <Cabecera
        migas={[{ etiqueta: "Biblioteca" }, { etiqueta: "Inicio" }]}
        titulo="Mi biblioteca"
      >
        <BotonNotificaciones userId={usuario.id} />
      </Cabecera>

      <Contenido>
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr] lg:items-start">
          {/* Columna principal */}
          <div className="flex flex-col gap-4">
            <Hero
              titulo={`Hola, ${primerNombre(usuario.nombre)}`}
              bajada={resumen(activos.length, vencidos.length, proxima)}
            />

            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
              <StatCard
                label="Préstamos activos"
                valor={activos.length}
                pie="En curso"
              />
              <StatCard
                label="Vencidos"
                valor={vencidos.length}
                tono="rojo"
                pie={
                  vencidos.length > 0 ? "Devolver cuanto antes" : "Nada atrasado"
                }
              />
              <StatCard
                label="Sanciones"
                valor={misSanciones.length}
                tono="verde"
                pie={
                  pendientes.length > 0
                    ? pendientes.length === 1
                      ? "Multa pendiente"
                      : "Multas pendientes"
                    : "Sin multas pendientes"
                }
              />
            </div>

            <Card padding={false}>
              <CardHeader
                titulo="Préstamos en curso"
                accion={
                  <Link
                    href="/prestamos"
                    className="text-[13px] font-semibold text-secundario hover:text-institucional"
                  >
                    Ver todos
                  </Link>
                }
              />

              {enCurso.length === 0 ? (
                <div className="px-5 py-8">
                  <SinResultados
                    titulo="No tenés préstamos en curso"
                    detalle="Buscá un título en el catálogo y solicitá tu primer préstamo."
                  />
                </div>
              ) : (
                <ul>
                  {enCurso.map((prestamo) => (
                    <li
                      key={prestamo.id}
                      className="flex items-center gap-4 border-b border-borde-fino px-5 py-3.5 last:border-b-0"
                    >
                      <Portada titulo={prestamo.libro.titulo} tamano="xs" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {prestamo.libro.titulo}
                        </p>
                        <p className="mt-0.5 text-xs text-tenue">
                          {nombreSede(prestamo.sede)} ·{" "}
                          {prestamo.diasAtraso > 0 ? "Venció" : "Vence"}{" "}
                          {formatFecha(prestamo.fechaLimite)}
                        </p>
                      </div>
                      <EstadoPrestamoPill
                        estado={prestamo.estado}
                        detalle={detalleEstado(prestamo)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          {/* Columna derecha */}
          <div className="flex flex-col gap-4">
            <Card>
              <h2 className="text-[15px] font-semibold">Avisos</h2>

              {avisos.length === 0 ? (
                <p className="mt-3 text-[13px] text-tenue">
                  No tenés avisos por ahora.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2.5">
                  {avisos.map((aviso) => (
                    <li
                      key={aviso.id}
                      className="overflow-hidden rounded-[11px] border border-aviso-borde"
                    >
                      <FilaNotificacion notificacion={aviso} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <h2 className="text-[15px] font-semibold">Próxima devolución</h2>
              {proxima ? (
                <>
                  <p className="serif mt-2.5 text-[26px] leading-none">
                    {formatFecha(proxima.fechaLimite)}
                  </p>
                  <p className="mt-1.5 text-[13px] text-tenue">
                    {proxima.libro.titulo} · {nombreSede(proxima.sede)}
                  </p>
                </>
              ) : (
                <>
                  <p className="serif mt-2.5 text-[26px] leading-none text-apagado">
                    —
                  </p>
                  <p className="mt-1.5 text-[13px] text-tenue">
                    No tenés devoluciones pendientes.
                  </p>
                </>
              )}
            </Card>
          </div>
        </div>
      </Contenido>
    </>
  );
}

/** "Ana García" -> "Ana", para el saludo del hero. */
function primerNombre(nombre: string): string {
  return nombre.split(" ")[0] ?? nombre;
}

/** Resumen de una linea del hero, armado con los contadores reales. */
function resumen(
  activos: number,
  vencidos: number,
  proxima: LoanView | undefined,
): string {
  if (activos === 0) {
    return "No tenés préstamos en curso. Buscá un título en el catálogo para empezar.";
  }

  let texto = `Tenés ${activos} ${activos === 1 ? "préstamo" : "préstamos"} en curso`;

  // Los vencidos son un subconjunto de los activos: "y N vencidos" se leería
  // como si fueran préstamos aparte.
  if (vencidos > 0) {
    texto += `, ${vencidos} ${vencidos === 1 ? "de ellos vencido" : "de ellos vencidos"}`;
  }
  texto += ".";

  if (proxima) {
    texto += ` El más próximo vence el ${formatFecha(proxima.fechaLimite)}.`;
  }

  return texto;
}

/** Segunda linea del pill: dias de atraso o dias restantes. */
function detalleEstado(prestamo: LoanView): string | undefined {
  if (prestamo.diasAtraso > 0) {
    return `${prestamo.diasAtraso} ${prestamo.diasAtraso === 1 ? "día" : "días"} de atraso`;
  }
  if (prestamo.estado === "proximo_a_vencer") {
    return `${prestamo.diasRestantes} ${prestamo.diasRestantes === 1 ? "día" : "días"} restantes`;
  }
  return undefined;
}

/**
 * Las dos notificaciones sin leer mas recientes. Si no hay ninguna sin
 * leer, caemos en las dos ultimas para que la tarjeta no quede vacia.
 */
function elegirAvisos(db: Db, userId: string) {
  const todas = notificacionesDe(db, userId);
  const nuevas = todas.filter((n) => !n.leida);
  return (nuevas.length > 0 ? nuevas : todas).slice(0, 2);
}
