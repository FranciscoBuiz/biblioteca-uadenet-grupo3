import Link from "next/link";

/** Pantalla para una ruta que no existe. */
export default function NoEncontrado() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-fondo px-5">
      <div className="w-full max-w-md text-center">
        <p className="eyebrow">Error 404</p>
        <h1 className="serif mt-2 text-[28px]">No encontramos esta página</h1>
        <p className="mt-2 text-sm leading-relaxed text-tenue">
          El enlace puede estar vencido o la dirección mal escrita. Volvé al
          inicio y seguí desde el menú.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-[10px] bg-institucional px-[26px] py-[13px] text-sm font-semibold text-white transition-colors hover:bg-secundario"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
