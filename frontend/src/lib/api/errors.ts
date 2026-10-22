/**
 * Error devuelto por el CORE Gateway ({code, message}) o por la red.
 *
 * El mensaje esta escrito para mostrarse tal cual en pantalla.
 * `codigo` es el status HTTP (0 si no hubo conexion); `code` es el
 * codigo de negocio del backend (ej. "NOT_FOUND"), si vino.
 */
export class ApiError extends Error {
  readonly codigo: number;
  readonly code?: string;

  constructor(mensaje: string, codigo = 400, code?: string) {
    super(mensaje);
    this.name = "ApiError";
    this.codigo = codigo;
    this.code = code;
  }
}

/** Extrae un mensaje presentable de cualquier cosa que haya sido lanzada. */
export function mensajeDeError(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrió un error inesperado. Intentá de nuevo.";
}
