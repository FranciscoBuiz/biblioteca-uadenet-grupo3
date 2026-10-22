"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import type { Rol } from "@/lib/domain/types";
import { useUsuario } from "@/lib/api/sesion";
import { AppShell } from "./AppShell";

/* ---------------------------------------------------------------
   Corta el acceso a un area segun el rol.

   Sin backend no hay sesion de verdad que validar: alcanza con
   mirar el usuario del store y, si no corresponde, mandarlo al
   login o al inicio de su propio perfil.
   --------------------------------------------------------------- */

export function Guard({
  rol,
  children,
}: {
  rol: Rol;
  children: ReactNode;
}) {
  const usuario = useUsuario();
  const router = useRouter();
  const autorizado = usuario?.rol === rol;

  useEffect(() => {
    if (!usuario) {
      router.replace("/login");
    } else if (usuario.rol !== rol) {
      router.replace(usuario.rol === "bibliotecario" ? "/admin" : "/inicio");
    }
  }, [usuario, rol, router]);

  if (!autorizado || !usuario) return <Redirigiendo />;

  return <AppShell usuario={usuario}>{children}</AppShell>;
}

function Redirigiendo() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-fondo">
      <p className="text-sm text-tenue" role="status">
        Redirigiendo…
      </p>
    </div>
  );
}
