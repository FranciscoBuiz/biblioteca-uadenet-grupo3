import { Aviso } from "./Card";

/** Lo que se muestra mientras una pantalla espera datos de la API, o si fallaron. */
export function SinDatos({ error }: { error: string | null }) {
  return error ? (
    <Aviso tono="error">{error}</Aviso>
  ) : (
    <p className="text-[13px] text-tenue" role="status">
      Cargando…
    </p>
  );
}
