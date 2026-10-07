/**
 * Error de "negocio" devuelto por la capa de API falsa.
 *
 * Equivale a un 4xx del CORE Gateway: el mensaje esta escrito para
 * mostrarse tal cual en pantalla.
 */
export class ApiError extends Error {
  readonly codigo: number;

  constructor(mensaje: string, codigo = 400) {
    super(mensaje);
    this.name = "ApiError";
    this.codigo = codigo;
  }
}

/** Extrae un mensaje presentable de cualquier cosa que haya sido lanzada. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado. Intentá de nuevo.";
}
