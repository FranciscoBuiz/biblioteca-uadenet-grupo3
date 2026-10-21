/* ---------------------------------------------------------------
   Portada de libro.

   La maqueta no usa imagenes: dibuja un lomo con una trama diagonal
   (la clase .lomo de globals.css). Para las tarjetas del catalogo
   agregamos el titulo sobre la trama, como en el mockup 03.
   --------------------------------------------------------------- */

const TAMANOS = {
  xs: "h-[46px] w-[34px] rounded-[5px]",
  sm: "h-[70px] w-[52px] rounded-md",
  md: "h-[150px] w-full rounded-[10px]",
  lg: "h-[220px] w-[160px] rounded-xl",
} as const;

export function Portada({
  titulo,
  tamano = "xs",
  mostrarTitulo = false,
}: {
  titulo: string;
  tamano?: keyof typeof TAMANOS;
  /** Superpone el título sobre la trama (tarjetas y ficha de detalle). */
  mostrarTitulo?: boolean;
}) {
  return (
    <div
      className={`lomo shrink-0 ${TAMANOS[tamano]} ${
        mostrarTitulo ? "flex items-center justify-center p-3" : ""
      }`}
      role="img"
      aria-label={`Portada de ${titulo}`}
    >
      {mostrarTitulo && (
        <span className="serif line-clamp-4 text-center text-[13px] leading-snug text-grafito">
          {titulo}
        </span>
      )}
    </div>
  );
}
