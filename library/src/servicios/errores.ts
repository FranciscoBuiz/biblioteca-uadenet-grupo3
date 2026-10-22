export class ErrorNegocio extends Error {
  constructor(
    readonly code: string,
    mensaje: string,
    readonly status = 400,
  ) {
    super(mensaje);
  }
}
