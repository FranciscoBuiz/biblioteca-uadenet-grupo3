"use client";

import { useState } from "react";
import { Cabecera, Contenido } from "@/components/shell/Cabecera";
import {
  BotonNotificaciones,
  FilaNotificacion,
} from "@/components/shell/PanelNotificaciones";
import { Boton } from "@/components/ui/Boton";
import { Card } from "@/components/ui/Card";
import { Tabs, type Opcion } from "@/components/ui/Filtros";
import { SinResultados } from "@/components/ui/Tabla";
import { markAllRead } from "@/lib/api/notifications";
import { useDb, useUsuarioActual } from "@/lib/store/LibraryProvider";
import {
  filtrarNotificaciones,
  type FiltroNotificaciones,
} from "@/lib/store/selectors";

/* ---------------------------------------------------------------
   Pantalla 13: historial completo de notificaciones del estudiante.

   Reutiliza FilaNotificacion del desplegable del header (pantalla
   12) para que las dos vistas se vean exactamente igual.
   --------------------------------------------------------------- */

const VACIO: Record<FiltroNotificaciones, { titulo: string; detalle: string }> =
  {
    todas: {
      titulo: "No tenés notificaciones",
      detalle: "Acá te vamos a avisar de vencimientos, sanciones y préstamos.",
    },
    sin_leer: {
      titulo: "No tenés notificaciones sin leer",
      detalle: "Ya estás al día con todos los avisos.",
    },
    vencimientos: {
      titulo: "No tenés avisos de vencimiento",
      detalle: "Te vamos a avisar cuando se acerque una fecha límite.",
    },
    sanciones: {
      titulo: "No tenés avisos de sanciones",
      detalle: "Devolvé los ejemplares en fecha y no vas a recibir multas.",
    },
  };

export default function TodasLasNotificaciones() {
  const db = useDb();
  const usuario = useUsuarioActual();
  const [filtro, setFiltro] = useState<FiltroNotificaciones>("todas");

  const todas = filtrarNotificaciones(db, usuario.id, "todas");
  const sinLeer = filtrarNotificaciones(db, usuario.id, "sin_leer").length;
  const visibles = filtrarNotificaciones(db, usuario.id, filtro);

  const opciones: Opcion<FiltroNotificaciones>[] = [
    { id: "todas", etiqueta: "Todas", cantidad: todas.length },
    { id: "sin_leer", etiqueta: "Sin leer", cantidad: sinLeer },
    {
      id: "vencimientos",
      etiqueta: "Vencimientos",
      cantidad: filtrarNotificaciones(db, usuario.id, "vencimientos").length,
    },
    {
      id: "sanciones",
      etiqueta: "Sanciones",
      cantidad: filtrarNotificaciones(db, usuario.id, "sanciones").length,
    },
  ];

  return (
    <>
      <Cabecera
        migas={[{ etiqueta: "Biblioteca" }, { etiqueta: "Notificaciones" }]}
        titulo="Todas las notificaciones"
      >
        <BotonNotificaciones userId={usuario.id} />
      </Cabecera>

      <Contenido>
        <Tabs
          opciones={opciones}
          valor={filtro}
          onChange={setFiltro}
          etiquetaGrupo="Filtrar notificaciones"
        />

        <div className="mt-4 max-w-[820px]">
          <Card padding={false}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borde-suave px-5 py-3.5">
              <h2 className="text-[15px] font-semibold">
                {todas.length}{" "}
                {todas.length === 1 ? "notificación" : "notificaciones"} ·{" "}
                {sinLeer} sin leer
              </h2>
              {sinLeer > 0 && (
                <Boton
                  variante="texto"
                  tamano="chico"
                  onClick={() => markAllRead(usuario.id)}
                >
                  Marcar todas como leídas
                </Boton>
              )}
            </div>

            {visibles.length === 0 ? (
              <div className="px-5 py-10">
                <SinResultados
                  titulo={VACIO[filtro].titulo}
                  detalle={VACIO[filtro].detalle}
                />
              </div>
            ) : (
              <>
                <ul className="divide-y divide-borde-fino">
                  {visibles.map((notificacion) => (
                    <li key={notificacion.id}>
                      <FilaNotificacion notificacion={notificacion} />
                    </li>
                  ))}
                </ul>
                <p className="border-t border-borde-fino bg-[#FBFCFD] px-5 py-3.5 text-center text-[13px] text-apagado">
                  No hay notificaciones más antiguas
                </p>
              </>
            )}
          </Card>
        </div>
      </Contenido>
    </>
  );
}
