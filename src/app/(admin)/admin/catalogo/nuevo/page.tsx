"use client";

import { useRouter } from "next/navigation";
import { Cabecera, Contenido } from "@/components/shell/Cabecera";
import { Card } from "@/components/ui/Card";
import { createBook } from "@/lib/api/books";
import { useDb } from "@/lib/store/LibraryProvider";
import {
  CATEGORIA_INICIAL,
  FormularioLibro,
  type DatosLibro,
} from "../FormularioLibro";

/* ---------------------------------------------------------------
   Pantalla 16: alta de libro y ejemplares.

   Un solo formulario carga la ficha bibliografica y los primeros
   ejemplares fisicos de una sede, igual que el mockup.
   --------------------------------------------------------------- */

export default function AltaDeLibro() {
  const router = useRouter();
  const db = useDb();

  async function guardar(datos: DatosLibro) {
    await createBook({
      isbn: datos.isbn,
      titulo: datos.titulo,
      autor: datos.autor,
      editorial: datos.editorial,
      anio: datos.anio,
      categoria: datos.categoria,
      descripcion: datos.descripcion,
      sede: datos.sede,
      cantidad: datos.cantidad,
    });
    router.push("/admin/catalogo");
  }

  return (
    <>
      <Cabecera
        migas={[
          { etiqueta: "Biblioteca" },
          { etiqueta: "Catálogo", href: "/admin/catalogo" },
          { etiqueta: "Nuevo" },
        ]}
        titulo="Alta de libro y ejemplares"
      />

      <Contenido ancho="angosto">
        <Card>
          <FormularioLibro
            modo="alta"
            bajada="Cargá los datos bibliográficos del título y la cantidad de ejemplares físicos que ingresan a la sede."
            textoGuardar="Guardar libro"
            inicial={{
              titulo: "",
              autor: "",
              isbn: "",
              editorial: "",
              anio: "",
              categoria: CATEGORIA_INICIAL,
              sede: db.sedeActiva,
              cantidad: "1",
              descripcion: "",
            }}
            onGuardar={guardar}
          />
        </Card>
      </Contenido>
    </>
  );
}
