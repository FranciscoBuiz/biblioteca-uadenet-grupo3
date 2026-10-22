"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Cabecera, Contenido } from "@/components/shell/Cabecera";
import { BotonLink } from "@/components/ui/Boton";
import { Aviso, Card } from "@/components/ui/Card";
import { SinResultados } from "@/components/ui/Tabla";
import { SinDatos } from "@/components/ui/SinDatos";
import { getBook, updateBook } from "@/lib/api/books";
import { useApi } from "@/lib/api/useApi";
import { useSedeActiva } from "@/lib/sedeActiva";
import { FormularioLibro, type DatosLibro } from "../../FormularioLibro";

/* ---------------------------------------------------------------
   Pantalla 17: editar libro.

   Mismo formulario que el alta, precargado y con el ISBN
   deshabilitado porque identifica al titulo. Los ejemplares no se
   tocan desde aca: se administran en la pantalla 18.
   --------------------------------------------------------------- */

export default function EditarLibro() {
  const { isbn } = useParams<{ isbn: string }>();
  const router = useRouter();
  const sedeActiva = useSedeActiva();

  const { datos: libro, error, cargando } = useApi(() => getBook(isbn), [isbn]);

  if (!libro && (cargando || error)) {
    return (
      <Contenido ancho="angosto">
        <SinDatos error={error} />
      </Contenido>
    );
  }

  if (!libro) {
    return (
      <>
        <Cabecera
          migas={[
            { etiqueta: "Biblioteca" },
            { etiqueta: "Catálogo", href: "/admin/catalogo" },
            { etiqueta: "Título no encontrado" },
          ]}
          titulo="Editar libro"
        />
        <Contenido ancho="angosto">
          <Card>
            <SinResultados
              titulo="No encontramos ese título"
              detalle={`No hay ningún título con el ISBN ${isbn} en el catálogo.`}
            />
            <div className="mt-5 flex justify-center">
              <BotonLink href="/admin/catalogo" variante="neutro">
                Volver al catálogo
              </BotonLink>
            </div>
          </Card>
        </Contenido>
      </>
    );
  }

  async function guardar(datos: DatosLibro) {
    await updateBook(isbn, {
      titulo: datos.titulo,
      autor: datos.autor,
      editorial: datos.editorial,
      anio: datos.anio,
      categoria: datos.categoria,
      descripcion: datos.descripcion,
    });
    router.push("/admin/catalogo");
  }

  return (
    <>
      <Cabecera
        migas={[
          { etiqueta: "Biblioteca" },
          { etiqueta: "Catálogo", href: "/admin/catalogo" },
          { etiqueta: libro.titulo },
        ]}
        titulo="Editar libro"
      />

      <Contenido ancho="angosto">
        <Card>
          <FormularioLibro
            modo="edicion"
            bajada="Modificá los datos del título. Los ejemplares se administran aparte."
            textoGuardar="Guardar cambios"
            inicial={{
              titulo: libro.titulo,
              autor: libro.autor,
              isbn: libro.isbn,
              editorial: libro.editorial,
              anio: String(libro.anio),
              categoria: libro.categoria,
              sede: sedeActiva,
              cantidad: "1",
              descripcion: libro.descripcion,
            }}
            avisoExtra={
              <Aviso tono="info">
                Los ejemplares físicos se administran desde la vista Ejemplares,
                no desde esta pantalla. Este título tiene {libro.totales}{" "}
                {libro.totales === 1 ? "ejemplar" : "ejemplares"}:{" "}
                {libro.disponibles} {libro.disponibles === 1 ? "disponible" : "disponibles"}{" "}
                y {libro.prestados} {libro.prestados === 1 ? "prestado" : "prestados"}.{" "}
                <Link
                  href={`/admin/catalogo/${libro.isbn}/ejemplares`}
                  className="font-semibold text-secundario underline"
                >
                  Ir a Ejemplares
                </Link>
              </Aviso>
            }
            onGuardar={guardar}
          />
        </Card>
      </Contenido>
    </>
  );
}
