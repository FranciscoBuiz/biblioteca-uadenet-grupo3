import type { Repositorio } from "../datos/repositorio.js";
import { diasAtraso } from "../dominio/reglas.js";
import type { Activity, EstadoEjemplar, FechaISO, SedeId } from "../dominio/tipos.js";

export interface Indicadores {
  titulos: number;
  ejemplares: number;
  disponibles: number;
  prestados: number;
  reservados: number;
  mantenimiento: number;
  vencidos: number;
}

export async function indicadores(
  repo: Repositorio,
  sede: SedeId | "todas",
  hoy: FechaISO,
): Promise<Indicadores> {
  const [libros, todos, prestamos] = await Promise.all([repo.libros(), repo.ejemplares(), repo.prestamos()]);
  const ejemplares = todos.filter((e) => e.estado !== "baja" && (sede === "todas" || e.sede === sede));
  const cuenta = (estado: EstadoEjemplar) => ejemplares.filter((e) => e.estado === estado).length;
  return {
    titulos: libros.filter((l) => l.activo && ejemplares.some((e) => e.isbn === l.isbn)).length,
    ejemplares: ejemplares.length,
    disponibles: cuenta("disponible"),
    prestados: cuenta("prestado"),
    reservados: cuenta("reservado"),
    mantenimiento: cuenta("mantenimiento"),
    vencidos: prestamos.filter(
      (p) => !p.fechaDevolucion && diasAtraso(p, hoy) > 0 && (sede === "todas" || p.sede === sede),
    ).length,
  };
}

/** Mas recientes primero; desempata por id. */
export async function actividadReciente(repo: Repositorio): Promise<Activity[]> {
  return (await repo.actividad()).sort(
    (a, b) => b.fecha.localeCompare(a.fecha) || b.hora.localeCompare(a.hora) || b.id.localeCompare(a.id),
  );
}
