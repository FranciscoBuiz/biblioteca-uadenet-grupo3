"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { logout } from "@/lib/api/auth";
import type { User } from "@/lib/domain/types";
import { getLoans } from "@/lib/api/loans";
import { getPenalties } from "@/lib/api/penalties";
import { useApi } from "@/lib/api/useApi";
import { esActivo, navDe, subtituloMarca, type ItemNav } from "./nav";

/* ---------------------------------------------------------------
   Menu lateral fijo de 236px sobre #1A2B4B, con la marca arriba, los
   items con su punto indicador y la ficha del usuario al pie.
   --------------------------------------------------------------- */

export function Sidebar({
  usuario,
  onNavegar,
}: {
  usuario: User;
  /** Se llama al tocar un item, para cerrar el drawer en mobile. */
  onNavegar?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const items = navDe(usuario.rol);
  const rol = usuario.rol;

  // Los badges fallan en silencio: un error de red no debe romper el menu.
  const { datos: activos } = useApi(
    () => (rol === "estudiante" ? getLoans({ estado: "activos" }) : Promise.resolve([])),
    [rol],
  );
  const { datos: pendientes } = useApi(() => getPenalties({ estado: "pendientes" }), [rol]);

  const badges: Record<NonNullable<ItemNav["badge"]>, number> = {
    prestamos: activos?.length ?? 0,
    sanciones: pendientes?.length ?? 0,
    vencidos: pendientes?.length ?? 0,
  };

  async function cerrarSesion() {
    await logout();
    router.push("/login");
  }

  return (
    <div className="flex h-full flex-col bg-institucional px-4 py-[22px] text-fondo">
      <Link
        href={usuario.rol === "bibliotecario" ? "/admin" : "/inicio"}
        onClick={onNavegar}
        className="px-2 pb-5"
      >
        <div className="serif text-[21px]">UADEnet</div>
        <div className="mt-[3px] text-[10px] uppercase tracking-[2px] text-sidebar-label">
          {subtituloMarca(usuario.rol)}
        </div>
      </Link>

      <nav aria-label="Menú principal" className="flex flex-col gap-[3px]">
        {items.map((item) => {
          const activo = esActivo(item.href, pathname);
          const cantidad = item.badge ? badges[item.badge] : 0;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavegar}
              aria-current={activo ? "page" : undefined}
              className={[
                "flex items-center gap-2.5 rounded-nav px-3 py-2.5 text-sm transition-colors",
                activo
                  ? "bg-secundario font-semibold text-white"
                  : "text-sidebar-texto hover:bg-sidebar-borde",
              ].join(" ")}
            >
              <span
                aria-hidden
                className={[
                  "size-1.5 shrink-0 rounded-[2px]",
                  activo ? "bg-white" : "bg-[#4A5E80]",
                ].join(" ")}
              />
              <span className="min-w-0 truncate">{item.etiqueta}</span>
              {cantidad > 0 && (
                <span className="ml-auto rounded-full bg-sidebar-borde px-2 py-px text-[11px] font-semibold">
                  {cantidad}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-sidebar-borde pt-3.5">
        <div className="flex items-center gap-2.5 px-3">
          <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-secundario text-xs font-semibold">
            {usuario.iniciales}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[13px] font-semibold">
              {usuario.nombre}
            </span>
            <span className="block text-[11px] text-sidebar-label">
              {usuario.etiqueta}
            </span>
          </span>
        </div>
        <button
          type="button"
          onClick={cerrarSesion}
          className="mt-2.5 w-full rounded-nav px-3 py-2 text-left text-xs font-semibold text-sidebar-texto transition-colors hover:bg-sidebar-borde hover:text-white"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

/** Barra inferior de navegación para mobile. */
export function BottomNav({ usuario }: { usuario: User }) {
  const pathname = usePathname();
  const items = navDe(usuario.rol);

  return (
    <nav
      aria-label="Navegación"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-sidebar-borde bg-institucional lg:hidden"
    >
      {items.map((item) => {
        const activo = esActivo(item.href, pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={activo ? "page" : undefined}
            className={[
              "flex-1 px-1 py-2.5 text-center text-[11px] font-semibold transition-colors",
              activo ? "text-white" : "text-sidebar-texto",
            ].join(" ")}
          >
            <span
              aria-hidden
              className={[
                "mx-auto mb-1 block h-0.5 w-5 rounded-full",
                activo ? "bg-white" : "bg-transparent",
              ].join(" ")}
            />
            <span className="block truncate">{item.corta ?? item.etiqueta}</span>
          </Link>
        );
      })}
    </nav>
  );
}

/** Contador de vencidos para el panel del bibliotecario. */
export function useVencidos(): number {
  const { datos } = useApi(() => getLoans({ estado: "vencidos" }), []);
  return datos?.length ?? 0;
}
