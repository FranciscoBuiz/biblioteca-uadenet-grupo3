"use client";

import { useState } from "react";
import { Boton, BotonLink } from "@/components/ui/Boton";
import { Aviso } from "@/components/ui/Card";
import {
  AccionesForm,
  Campo,
  CampoSelect,
  CampoTexto,
  GrillaCampos,
} from "@/components/ui/Form";
import { Portada } from "@/components/ui/Portada";
import { mensajeDeError } from "@/lib/api/errors";
import {
  CATEGORIAS,
  SEDES,
  validarAnio,
  validarCantidad,
  validarIsbn,
  validarObligatorio,
} from "@/lib/domain/rules";
import type { Categoria, SedeId } from "@/lib/domain/types";

/* ---------------------------------------------------------------
   Formulario compartido por el alta (pantalla 16) y la edicion
   (pantalla 17) de un titulo.

   Las dos pantallas muestran la misma grilla de campos: la unica
   diferencia es que en la edicion el ISBN viene deshabilitado y no
   se piden sede ni cantidad, porque los ejemplares se administran
   en la pantalla 18.

   La validacion es en vivo: cada campo se valida al perder el foco
   y todos de nuevo al enviar, igual que el estado de error que el
   mockup 16 muestra sobre el ISBN.
   --------------------------------------------------------------- */

export const CATEGORIA_INICIAL: Categoria = CATEGORIAS[0];

/** Valores del formulario: todo texto, como lo maneja un input. */
export interface ValoresLibro {
  titulo: string;
  autor: string;
  isbn: string;
  editorial: string;
  anio: string;
  categoria: Categoria;
  sede: SedeId;
  cantidad: string;
  descripcion: string;
}

/** Valores ya convertidos a los tipos que espera la API. */
export interface DatosLibro {
  titulo: string;
  autor: string;
  isbn: string;
  editorial: string;
  anio: number;
  categoria: Categoria;
  sede: SedeId;
  cantidad: number;
  descripcion: string;
}

type Campos = keyof ValoresLibro;
type Errores = Partial<Record<Campos, string>>;

export function FormularioLibro({
  modo,
  inicial,
  bajada,
  textoGuardar,
  avisoExtra,
  onGuardar,
}: {
  /** "alta" pide ISBN, sede y cantidad; "edicion" deshabilita el ISBN. */
  modo: "alta" | "edicion";
  inicial: ValoresLibro;
  bajada: string;
  textoGuardar: string;
  /** Bloque opcional sobre las acciones, como la nota de la pantalla 17. */
  avisoExtra?: React.ReactNode;
  onGuardar: (datos: DatosLibro) => Promise<void>;
}) {
  const esAlta = modo === "alta";

  const [valores, setValores] = useState<ValoresLibro>(inicial);
  const [errores, setErrores] = useState<Errores>({});
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  /** Valida un solo campo. Devuelve null cuando el campo esta bien. */
  function validar(campo: Campos, valores: ValoresLibro): string | null {
    switch (campo) {
      case "titulo":
        return validarObligatorio(valores.titulo, "El título");
      case "autor":
        return validarObligatorio(valores.autor, "El autor");
      case "isbn":
        return esAlta ? validarIsbn(valores.isbn) : null;
      case "anio":
        return validarAnio(valores.anio);
      case "cantidad":
        return esAlta ? validarCantidad(valores.cantidad) : null;
      default:
        return null;
    }
  }

  /** Campos que participan de la validacion, segun el modo. */
  const validables: Campos[] = esAlta
    ? ["titulo", "autor", "isbn", "anio", "cantidad"]
    : ["titulo", "autor", "anio"];

  function cambiar<C extends Campos>(campo: C, valor: ValoresLibro[C]) {
    const siguientes = { ...valores, [campo]: valor };
    setValores(siguientes);

    // Si el campo ya tenia error, lo revalidamos mientras se escribe
    // para que el mensaje desaparezca en cuanto se corrige.
    if (errores[campo]) {
      setErrores({ ...errores, [campo]: validar(campo, siguientes) ?? undefined });
    }
  }

  function alSalir(campo: Campos) {
    setErrores((previos) => ({
      ...previos,
      [campo]: validar(campo, valores) ?? undefined,
    }));
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setError(null);

    const encontrados: Errores = {};
    for (const campo of validables) {
      const mensaje = validar(campo, valores);
      if (mensaje) encontrados[campo] = mensaje;
    }
    setErrores(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    setEnviando(true);
    try {
      await onGuardar({
        titulo: valores.titulo,
        autor: valores.autor,
        isbn: valores.isbn.replace(/[\s-]/g, ""),
        editorial: valores.editorial,
        anio: Number(valores.anio),
        categoria: valores.categoria,
        sede: valores.sede,
        cantidad: Number(valores.cantidad),
        descripcion: valores.descripcion,
      });
    } catch (e) {
      setError(mensajeDeError(e));
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} noValidate>
      <p className="text-[13px] leading-relaxed text-tenue">{bajada}</p>

      <div className="mt-5">
        <GrillaCampos>
          <div className="sm:col-span-2">
            <Campo
              label="Título"
              value={valores.titulo}
              onChange={(e) => cambiar("titulo", e.target.value)}
              onBlur={() => alSalir("titulo")}
              error={errores.titulo}
              placeholder="Refactoring"
              obligatorio
            />
          </div>

          <Campo
            label="Autor"
            value={valores.autor}
            onChange={(e) => cambiar("autor", e.target.value)}
            onBlur={() => alSalir("autor")}
            error={errores.autor}
            placeholder="Martin Fowler"
            obligatorio
          />

          <Campo
            label="ISBN"
            inputMode="numeric"
            value={valores.isbn}
            onChange={(e) => cambiar("isbn", e.target.value)}
            onBlur={() => alSalir("isbn")}
            error={esAlta ? errores.isbn : undefined}
            ayuda={
              esAlta
                ? undefined
                : "El ISBN identifica al título y no se puede modificar."
            }
            placeholder="9780134757599"
            disabled={!esAlta}
            obligatorio
          />

          <Campo
            label="Editorial"
            value={valores.editorial}
            onChange={(e) => cambiar("editorial", e.target.value)}
            placeholder="Addison-Wesley"
          />

          <Campo
            label="Año"
            inputMode="numeric"
            value={valores.anio}
            onChange={(e) => cambiar("anio", e.target.value)}
            onBlur={() => alSalir("anio")}
            error={errores.anio}
            placeholder="2018"
            obligatorio
          />

          <CampoSelect
            label="Categoría"
            value={valores.categoria}
            onChange={(e) => cambiar("categoria", e.target.value as Categoria)}
            opciones={CATEGORIAS.map((categoria) => ({
              valor: categoria,
              etiqueta: categoria,
            }))}
          />

          {esAlta && (
            <>
              <CampoSelect
                label="Sede asignada"
                value={valores.sede}
                onChange={(e) => cambiar("sede", e.target.value as SedeId)}
                opciones={SEDES.map((sede) => ({
                  valor: sede.id,
                  etiqueta: `${sede.nombre} (${sede.ciudad})`,
                }))}
                ayuda="Sede donde ingresan los primeros ejemplares."
              />

              <Campo
                label="Cantidad de ejemplares"
                inputMode="numeric"
                value={valores.cantidad}
                onChange={(e) => cambiar("cantidad", e.target.value)}
                onBlur={() => alSalir("cantidad")}
                error={errores.cantidad}
                placeholder="3"
                obligatorio
              />
            </>
          )}

          <div className="sm:col-span-2">
            <CampoTexto
              label="Descripción"
              value={valores.descripcion}
              onChange={(e) => cambiar("descripcion", e.target.value)}
              placeholder="Resumen del contenido y uso que se le da en las materias."
            />
          </div>
        </GrillaCampos>
      </div>

      <CampoPortada titulo={valores.titulo} />

      {avisoExtra && <div className="mt-4">{avisoExtra}</div>}

      {error && (
        <div className="mt-4">
          <Aviso tono="error">{error}</Aviso>
        </div>
      )}

      <div className="mt-5">
        <AccionesForm>
          <Boton type="submit" variante="confirmar" cargando={enviando}>
            {textoGuardar}
          </Boton>
          <BotonLink href="/admin/catalogo" variante="neutro">
            Cancelar
          </BotonLink>
        </AccionesForm>
      </div>
    </form>
  );
}

/**
 * Recuadro de portada del mockup.
 *
 * La maqueta no usa imagenes reales (dibuja la trama diagonal del lomo) y sin
 * backend no hay donde subir un archivo, asi que mostramos la portada generada
 * y lo aclaramos en lugar de ofrecer un upload que no haria nada.
 */
function CampoPortada({ titulo }: { titulo: string }) {
  return (
    <div className="mt-4">
      <p className="mb-1.5 text-xs font-semibold text-grafito">Portada</p>
      <div className="flex items-center gap-4 rounded-[10px] border border-dashed border-borde-fuerte bg-[#FBFCFD] px-4 py-3.5">
        <Portada titulo={titulo || "Sin título"} tamano="sm" />
        <p className="text-xs leading-relaxed text-tenue">
          La portada se genera a partir del título. Sin backend no hay dónde
          subir una imagen, así que el catálogo usa esta trama para todos los
          títulos, igual que la maqueta.
        </p>
      </div>
    </div>
  );
}
