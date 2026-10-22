"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@/lib/domain/types";
import { BottomNav, Sidebar } from "./Sidebar";

/* ---------------------------------------------------------------
   Armazon de la aplicacion.

   Desktop: sidebar fijo de 236px + columna de contenido, igual que
   la maqueta. Tablet y mobile: el sidebar pasa a un drawer que se
   abre desde la cabecera, y la navegacion principal queda en una
   barra inferior.
   --------------------------------------------------------------- */

const ContextoDrawer = createContext<{ abrir: () => void } | null>(null);

/** Permite a la cabecera abrir el drawer en pantallas chicas. */
export function useDrawer() {
  return useContext(ContextoDrawer);
}

export function AppShell({
  usuario,
  children,
}: {
  usuario: User;
  children: ReactNode;
}) {
  const [drawerAbierto, setDrawerAbierto] = useState(false);

  useEffect(() => {
    if (!drawerAbierto) return;

    const alTeclear = (evento: KeyboardEvent) => {
      if (evento.key === "Escape") setDrawerAbierto(false);
    };
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", alTeclear);

    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflowPrevio;
    };
  }, [drawerAbierto]);

  return (
    <ContextoDrawer.Provider value={{ abrir: () => setDrawerAbierto(true) }}>
      <div className="flex min-h-screen bg-fondo">
        <aside className="hidden w-[236px] shrink-0 lg:block">
          <div className="sticky top-0 h-screen">
            <Sidebar usuario={usuario} />
          </div>
        </aside>

        <main className="min-w-0 flex-1 pb-[76px] lg:pb-0">{children}</main>
      </div>

      {drawerAbierto && (
        <div
          className="fixed inset-0 z-50 flex lg:hidden"
          onMouseDown={(evento) => {
            if (evento.target === evento.currentTarget) setDrawerAbierto(false);
          }}
        >
          <div
            className="absolute inset-0 bg-[rgba(16,24,40,0.45)]"
            aria-hidden
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Menú"
            className="relative w-[262px] max-w-[85vw]"
          >
            <Sidebar
              usuario={usuario}
              onNavegar={() => setDrawerAbierto(false)}
            />
          </div>
        </div>
      )}

      <BottomNav usuario={usuario} />
    </ContextoDrawer.Provider>
  );
}
