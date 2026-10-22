"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Boton } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Card";
import { Campo } from "@/components/ui/Form";
import { CUENTAS_DEMO, login } from "@/lib/api/auth";
import { mensajeDeError } from "@/lib/api/errors";
import { useUsuario } from "@/lib/api/sesion";

/* ---------------------------------------------------------------
   Pantalla 01: panel de marca a la izquierda y formulario de
   ingreso a la derecha.

   Al no haber backend, la contrasena es la misma para los dos
   perfiles y se ofrecen atajos para cargar cada cuenta.
   --------------------------------------------------------------- */

export default function PaginaLogin() {
  const router = useRouter();
  const usuario = useUsuario();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Si ya hay sesion abierta, no tiene sentido mostrar el login.
  useEffect(() => {
    if (usuario) {
      router.replace(usuario.rol === "bibliotecario" ? "/admin" : "/inicio");
    }
  }, [usuario, router]);

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);
    setEnviando(true);

    try {
      const ingresado = await login(email, password);
      router.replace(
        ingresado.rol === "bibliotecario" ? "/admin" : "/inicio",
      );
    } catch (e) {
      setError(mensajeDeError(e));
      setEnviando(false);
    }
  }

  function usarCuenta(cuenta: (typeof CUENTAS_DEMO)[number]) {
    setEmail(cuenta.email);
    setPassword(cuenta.password);
    setError(null);
  }

  return (
    <div className="min-h-screen bg-fondo lg:grid lg:min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Panel de marca */}
      <div className="flex flex-col justify-between gap-10 bg-institucional px-7 py-10 text-fondo sm:px-12 sm:py-14 lg:px-[52px] lg:py-14">
        <div>
          <p className="serif text-[26px] sm:text-[30px]">UADEnet</p>
          <p className="mt-1.5 text-xs uppercase tracking-[2.4px] text-sidebar-label">
            Biblioteca Universitaria
          </p>
        </div>

        <p className="max-w-sm text-sm leading-relaxed text-sidebar-texto lg:text-base">
          Consultá el catálogo, revisá la disponibilidad por sede y hacé el
          seguimiento de tus préstamos, vencimientos y sanciones.
        </p>

        <p className="text-xs text-[#6C82A6]">
          Universidad Argentina de la Empresa
        </p>
      </div>

      {/* Formulario */}
      <div className="flex items-center justify-center px-5 py-10 sm:px-10">
        <div className="w-full max-w-[372px]">
          <h1 className="serif text-[28px]">Ingresar</h1>
          <p className="mt-1.5 text-sm text-tenue">
            Usá tu correo institucional y tu contraseña de UADEnet.
          </p>

          <form onSubmit={enviar} className="mt-6 flex flex-col gap-3.5" noValidate>
            <Campo
              label="Mail institucional"
              type="email"
              autoComplete="username"
              placeholder="nombre.apellido@uade.edu.ar"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              obligatorio
            />
            <Campo
              label="Contraseña"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              obligatorio
            />

            {error && <Aviso tono="error">{error}</Aviso>}

            <Boton
              type="submit"
              variante="institucional"
              ancho
              cargando={enviando}
            >
              Ingresar
            </Boton>
          </form>

          <div className="mt-7 rounded-tarjeta border border-borde bg-white p-4">
            <p className="eyebrow">Cuentas de la demo</p>
            <ul className="mt-2.5 flex flex-col gap-2">
              {CUENTAS_DEMO.map((cuenta) => (
                <li key={cuenta.email}>
                  <button
                    type="button"
                    onClick={() => usarCuenta(cuenta)}
                    className="w-full rounded-[10px] border border-borde-fuerte px-3 py-2.5 text-left transition-colors hover:border-secundario"
                  >
                    <span className="block text-[13px] font-semibold">
                      {cuenta.email}
                    </span>
                    <span className="mt-0.5 block text-xs text-tenue">
                      {cuenta.descripcion}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2.5 text-[11px] text-apagado">
              Contraseña para ambas:{" "}
              <span className="font-mono">uade1234</span>
            </p>
          </div>

          <p className="mt-6 text-center text-xs leading-relaxed text-apagado">
            Si tenés problemas para ingresar, comunicate con Soporte UADEnet.
          </p>
        </div>
      </div>
    </div>
  );
}
