import type {
  Activity,
  Book,
  Copy,
  Loan,
  Location,
  Notification,
  Penalty,
  Tarifa,
} from "../dominio/tipos.js";

/** Acceso a datos de la Biblioteca. Todo es asincrono: la implementacion real es MariaDB. */
export interface Repositorio {
  libros(): Promise<Book[]>;
  libro(isbn: string): Promise<Book | undefined>;
  guardarLibro(libro: Book): Promise<void>;
  ejemplares(isbn?: string): Promise<Copy[]>;
  guardarEjemplares(copias: Copy[]): Promise<void>;
  prestamos(): Promise<Loan[]>;
  prestamo(id: string): Promise<Loan | undefined>;
  guardarPrestamo(l: Loan): Promise<void>;
  guardarSancion(p: Penalty): Promise<void>;
  sanciones(): Promise<Penalty[]>;
  sancion(id: string): Promise<Penalty | undefined>;
  sancionDe(loanId: string): Promise<Penalty | undefined>;
  notificaciones(userId: string): Promise<Notification[]>;
  guardarNotificaciones(n: Notification[]): Promise<void>;
  actividad(): Promise<Activity[]>;
  registrarActividad(a: Activity): Promise<void>;
  tarifas(): Promise<Tarifa[]>;
  agregarTarifa(t: Tarifa): Promise<void>;
  ubicaciones(): Promise<Location[]>;
  guardarUbicacion(l: Location): Promise<void>;
  siguienteId(tipo: "prestamo" | "sancion"): Promise<string>; // "PRE-1009", "SAN-00032"
  /**
   * Unidad de trabajo: todo lo que se escribe adentro se aplica junto o nada
   * (en MariaDB, una transaccion). Las transacciones se SERIALIZAN: dos pedidos
   * por el ultimo ejemplar no pueden leer el mismo estado.
   */
  transaccion<T>(trabajo: (repo: Repositorio) => Promise<T>): Promise<T>;
}
