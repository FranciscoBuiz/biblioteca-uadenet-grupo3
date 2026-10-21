"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useUsuario } from "@/lib/store/LibraryProvider";

/**
 * Raiz: manda a cada quien a su inicio.
 *
 * Tiene que ser client component porque la sesion de la demo vive en
 * localStorage y el servidor no la ve.
 */
export default function Raiz() {
  const usuario = useUsuario();
  const router = useRouter();

  useEffect(() => {
    if (!usuario) {
      router.replace("/login");
    } else {
      router.replace(usuario.rol === "bibliotecario" ? "/admin" : "/inicio");
    }
  }, [usuario, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-fondo">
      <p className="text-sm text-tenue" role="status">
        Cargando…
      </p>
    </div>
  );
}
