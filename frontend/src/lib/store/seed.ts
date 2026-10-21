import type {
  Activity,
  Book,
  Copy,
  Loan,
  Notification,
  Penalty,
  User,
} from "@/lib/domain/types";

/* ---------------------------------------------------------------
   Datos iniciales de la demo, tomados literalmente de la maqueta.
   Con HOY = 2026-08-26 los estados calculados coinciden con las
   capturas del PDF (PRE-1003 a 2 días de vencer, PRE-1002 con 3
   días de atraso, PRE-1001 con 18).

   Dos desvíos deliberados respecto de las capturas:

   1. SAN-00031 queda "pendiente" en lugar de "cobrada" para que el
      flujo 09 → 10 → 11 (detalle, pago y comprobante) sea
      recorrible de punta a punta.
   2. Los contadores agregados del panel del bibliotecario se
      derivan de estos datos en vez de estar fijos: las capturas 14,
      15 y 19 no cierran entre sí (27 vs 18 ejemplares totales), así
      que preferimos un dataset internamente consistente.
   --------------------------------------------------------------- */

export const USUARIOS: User[] = [
  {
    id: "u-ana",
    nombre: "Ana García",
    email: "ana.garcia@uade.edu.ar",
    legajo: "1102345",
    dni: "41.222.333",
    rol: "estudiante",
    sedeDefault: "monserrat",
    iniciales: "AG",
    etiqueta: "Estudiante",
  },
  {
    id: "u-laura",
    nombre: "Laura Fernández",
    email: "laura.fernandez@uade.edu.ar",
    legajo: "9000112",
    dni: "33.654.120",
    rol: "bibliotecario",
    sedeDefault: "monserrat",
    iniciales: "LF",
    etiqueta: "Bibliotecaria",
  },
  {
    id: "u-martin",
    nombre: "Martín Souza",
    email: "martin.souza@uade.edu.ar",
    legajo: "1104871",
    dni: "42.118.904",
    rol: "estudiante",
    sedeDefault: "monserrat",
    iniciales: "MS",
    etiqueta: "Estudiante",
  },
  {
    id: "u-julian",
    nombre: "Julián Pérez",
    email: "julian.perez@uade.edu.ar",
    legajo: "1103662",
    dni: "40.877.215",
    rol: "estudiante",
    sedeDefault: "pinamar",
    iniciales: "JP",
    etiqueta: "Estudiante",
  },
  {
    id: "u-camila",
    nombre: "Camila Ruiz",
    email: "camila.ruiz@uade.edu.ar",
    legajo: "1105230",
    dni: "43.009.517",
    rol: "estudiante",
    sedeDefault: "monserrat",
    iniciales: "CR",
    etiqueta: "Estudiante",
  },
];

export const LIBROS: Book[] = [
  {
    isbn: "9780132350884",
    titulo: "Clean Code",
    autor: "Robert C. Martin",
    editorial: "Prentice Hall",
    anio: 2008,
    categoria: "Programación",
    descripcion:
      "Guía de escritura de código legible y mantenible a través de casos, olores de código y refactors comentados paso a paso. Material de consulta frecuente para las materias de programación y diseño.",
    activo: true,
  },
  {
    isbn: "9780201633610",
    titulo: "Design Patterns",
    autor: "Gamma, Helm, Johnson, Vlissides",
    editorial: "Addison-Wesley",
    anio: 1994,
    categoria: "Arquitectura",
    descripcion:
      "El catálogo original de los veintitrés patrones de diseño orientado a objetos, con la intención, la estructura y las consecuencias de cada uno. Referencia obligada en arquitectura de software.",
    activo: true,
  },
  {
    isbn: "9780134494166",
    titulo: "Arquitectura Limpia",
    autor: "Robert C. Martin",
    editorial: "Prentice Hall",
    anio: 2017,
    categoria: "Arquitectura",
    descripcion:
      "Principios de diseño de componentes y límites arquitectónicos para que las decisiones técnicas queden aisladas de las reglas de negocio. Complementa la cursada de diseño de sistemas.",
    activo: true,
  },
  {
    isbn: "9780321125217",
    titulo: "Domain-Driven Design",
    autor: "Eric Evans",
    editorial: "Addison-Wesley",
    anio: 2003,
    categoria: "Arquitectura",
    descripcion:
      "Modelado de dominios complejos a partir del lenguaje del negocio: entidades, agregados, repositorios y contextos delimitados, con ejemplos extensos de refinamiento del modelo.",
    activo: true,
  },
  {
    isbn: "9780134757599",
    titulo: "Refactoring",
    autor: "Martin Fowler",
    editorial: "Addison-Wesley",
    anio: 2018,
    categoria: "Programación",
    descripcion:
      "Catálogo de refactorizaciones con su motivación, mecánica y ejemplos, pensado para mejorar el diseño de código existente sin cambiar su comportamiento observable.",
    activo: true,
  },
  {
    isbn: "9788448156800",
    titulo: "Introducción a los Algoritmos",
    autor: "Cormen, Leiserson, Rivest, Stein",
    editorial: "McGraw-Hill",
    anio: 2009,
    categoria: "Algoritmos",
    descripcion:
      "Tratado integral de algoritmos y estructuras de datos con análisis de complejidad riguroso. Es el libro de cabecera de la materia de algoritmos y el de mayor rotación del catálogo.",
    activo: true,
  },
  {
    isbn: "9786073227254",
    titulo: "Sistemas Operativos Modernos",
    autor: "Andrew S. Tanenbaum",
    editorial: "Pearson",
    anio: 2009,
    categoria: "Sistemas",
    descripcion:
      "Procesos, memoria, sistemas de archivos y entrada/salida explicados con casos reales de Unix, Linux y Windows, más capítulos de seguridad y sistemas distribuidos.",
    activo: true,
  },
  {
    isbn: "9780078022159",
    titulo: "Database System Concepts",
    autor: "Silberschatz, Korth, Sudarshan",
    editorial: "McGraw-Hill",
    anio: 2019,
    categoria: "Bases de datos",
    descripcion:
      "Modelo relacional, SQL, diseño de esquemas, índices, transacciones y recuperación ante fallos. Base teórica de la materia de bases de datos.",
    activo: true,
  },
  {
    isbn: "9780201616224",
    titulo: "The Pragmatic Programmer",
    autor: "Hunt & Thomas",
    editorial: "Addison-Wesley",
    anio: 1999,
    categoria: "Programación",
    descripcion:
      "Prácticas de oficio para desarrolladores: automatización, trazabilidad, prototipado y manejo de la deuda técnica, en capítulos cortos e independientes.",
    activo: true,
  },
  {
    isbn: "9780321965516",
    titulo: "Don't Make Me Think",
    autor: "Steve Krug",
    editorial: "New Riders",
    anio: 2014,
    categoria: "UX",
    descripcion:
      "Introducción breve a la usabilidad web centrada en la claridad: convenciones, jerarquía visual y pruebas de usabilidad baratas que cualquier equipo puede correr.",
    activo: true,
  },
  {
    isbn: "9789702611219",
    titulo: "Redes de Computadoras",
    autor: "Andrew S. Tanenbaum",
    editorial: "Pearson",
    anio: 2012,
    categoria: "Redes",
    descripcion:
      "Recorrido por la pila de protocolos capa por capa, desde el medio físico hasta la capa de aplicación, con énfasis en TCP/IP y en el diseño de redes reales.",
    activo: false,
  },
  {
    isbn: "9788478290745",
    titulo: "Ingeniería de Software",
    autor: "Ian Sommerville",
    editorial: "Pearson",
    anio: 2011,
    categoria: "Sistemas",
    descripcion:
      "Ciclo de vida del software, requerimientos, modelado, verificación y gestión de proyectos, con capítulos sobre sistemas críticos y evolución del software.",
    activo: true,
  },
];

export const EJEMPLARES: Copy[] = [
  // Clean Code: Monserrat 2 de 3 libres, Pinamar 0 de 1
  { codigo: "BA-001", isbn: "9780132350884", sede: "monserrat", estado: "disponible" },
  { codigo: "BA-002", isbn: "9780132350884", sede: "monserrat", estado: "disponible" },
  { codigo: "BA-003", isbn: "9780132350884", sede: "monserrat", estado: "prestado" },
  { codigo: "BA-028", isbn: "9780132350884", sede: "pinamar", estado: "mantenimiento" },
  // Design Patterns: Monserrat 1 disponible
  { codigo: "BA-004", isbn: "9780201633610", sede: "monserrat", estado: "prestado" },
  { codigo: "BA-005", isbn: "9780201633610", sede: "monserrat", estado: "disponible" },
  { codigo: "BA-006", isbn: "9780201633610", sede: "belgrano", estado: "disponible" },
  // Arquitectura Limpia: Monserrat sin stock
  { codigo: "BA-007", isbn: "9780134494166", sede: "monserrat", estado: "prestado" },
  { codigo: "BA-008", isbn: "9780134494166", sede: "belgrano", estado: "disponible" },
  // Domain-Driven Design
  { codigo: "BA-009", isbn: "9780321125217", sede: "monserrat", estado: "prestado" },
  { codigo: "BA-010", isbn: "9780321125217", sede: "belgrano", estado: "disponible" },
  // Refactoring
  { codigo: "BA-011", isbn: "9780134757599", sede: "monserrat", estado: "disponible" },
  { codigo: "BA-029", isbn: "9780134757599", sede: "belgrano", estado: "disponible" },
  // Introducción a los Algoritmos: Monserrat 3 disponibles
  { codigo: "BA-012", isbn: "9788448156800", sede: "monserrat", estado: "disponible" },
  { codigo: "BA-013", isbn: "9788448156800", sede: "monserrat", estado: "disponible" },
  { codigo: "BA-014", isbn: "9788448156800", sede: "monserrat", estado: "prestado" },
  { codigo: "BA-015", isbn: "9788448156800", sede: "monserrat", estado: "disponible" },
  // Sistemas Operativos Modernos: Monserrat 2 disponibles
  { codigo: "BA-016", isbn: "9786073227254", sede: "monserrat", estado: "disponible" },
  { codigo: "BA-017", isbn: "9786073227254", sede: "monserrat", estado: "disponible" },
  { codigo: "BA-018", isbn: "9786073227254", sede: "pinamar", estado: "prestado" },
  // Database System Concepts: Monserrat 1 disponible
  { codigo: "BA-019", isbn: "9780078022159", sede: "monserrat", estado: "disponible" },
  { codigo: "BA-020", isbn: "9780078022159", sede: "monserrat", estado: "prestado" },
  // The Pragmatic Programmer: Monserrat 2 disponibles
  { codigo: "BA-021", isbn: "9780201616224", sede: "monserrat", estado: "disponible" },
  { codigo: "BA-022", isbn: "9780201616224", sede: "monserrat", estado: "disponible" },
  // Don't Make Me Think: Monserrat 2 disponibles
  { codigo: "BA-023", isbn: "9780321965516", sede: "monserrat", estado: "disponible" },
  { codigo: "BA-024", isbn: "9780321965516", sede: "monserrat", estado: "disponible" },
  // Redes de Computadoras: título dado de baja
  { codigo: "BA-026", isbn: "9789702611219", sede: "pinamar", estado: "mantenimiento" },
  { codigo: "BA-027", isbn: "9789702611219", sede: "pinamar", estado: "reservado" },
  // Ingeniería de Software
  { codigo: "BA-030", isbn: "9788478290745", sede: "monserrat", estado: "disponible" },
  { codigo: "BA-031", isbn: "9788478290745", sede: "belgrano", estado: "disponible" },
];

export const PRESTAMOS: Loan[] = [
  {
    id: "PRE-0993",
    isbn: "9788478290745",
    copia: "BA-030",
    userId: "u-ana",
    sede: "monserrat",
    fechaPrestamo: "2026-06-20",
    fechaLimite: "2026-07-04",
    fechaDevolucion: "2026-07-14",
    renovaciones: 0,
    codigoRetiro: "RET-118205",
    tieneReservas: false,
  },
  {
    id: "PRE-0994",
    isbn: "9780134757599",
    copia: "BA-011",
    userId: "u-camila",
    sede: "monserrat",
    fechaPrestamo: "2026-07-04",
    fechaLimite: "2026-07-18",
    fechaDevolucion: "2026-07-30",
    renovaciones: 0,
    codigoRetiro: "RET-310744",
    tieneReservas: false,
  },
  {
    id: "PRE-1001",
    isbn: "9780132350884",
    copia: "BA-003",
    userId: "u-ana",
    sede: "monserrat",
    fechaPrestamo: "2026-07-25",
    fechaLimite: "2026-08-08",
    fechaDevolucion: null,
    renovaciones: 0,
    codigoRetiro: "RET-220901",
    tieneReservas: true,
  },
  {
    id: "PRE-1002",
    isbn: "9780321125217",
    copia: "BA-009",
    userId: "u-ana",
    sede: "monserrat",
    fechaPrestamo: "2026-08-09",
    fechaLimite: "2026-08-23",
    fechaDevolucion: null,
    renovaciones: 0,
    codigoRetiro: "RET-401265",
    tieneReservas: false,
  },
  {
    id: "PRE-1003",
    isbn: "9788448156800",
    copia: "BA-014",
    userId: "u-ana",
    sede: "monserrat",
    fechaPrestamo: "2026-08-14",
    fechaLimite: "2026-08-28",
    fechaDevolucion: null,
    renovaciones: 0,
    codigoRetiro: "RET-556012",
    tieneReservas: false,
  },
  {
    id: "PRE-1004",
    isbn: "9780078022159",
    copia: "BA-020",
    userId: "u-ana",
    sede: "monserrat",
    fechaPrestamo: "2026-08-23",
    fechaLimite: "2026-09-06",
    fechaDevolucion: null,
    renovaciones: 0,
    codigoRetiro: "RET-618430",
    tieneReservas: false,
  },
  {
    id: "PRE-1005",
    isbn: "9780321965516",
    copia: "BA-023",
    userId: "u-ana",
    sede: "monserrat",
    fechaPrestamo: "2026-07-17",
    fechaLimite: "2026-07-31",
    fechaDevolucion: "2026-07-29",
    renovaciones: 0,
    codigoRetiro: "RET-193377",
    tieneReservas: false,
  },
  {
    id: "PRE-1006",
    isbn: "9780201633610",
    copia: "BA-004",
    userId: "u-martin",
    sede: "monserrat",
    fechaPrestamo: "2026-07-24",
    fechaLimite: "2026-08-07",
    fechaDevolucion: null,
    renovaciones: 0,
    codigoRetiro: "RET-204518",
    tieneReservas: false,
  },
  {
    id: "PRE-1007",
    isbn: "9786073227254",
    copia: "BA-018",
    userId: "u-julian",
    sede: "pinamar",
    fechaPrestamo: "2026-08-17",
    fechaLimite: "2026-08-31",
    fechaDevolucion: null,
    renovaciones: 0,
    codigoRetiro: "RET-577106",
    tieneReservas: false,
  },
  {
    id: "PRE-1008",
    isbn: "9780134494166",
    copia: "BA-007",
    userId: "u-camila",
    sede: "monserrat",
    fechaPrestamo: "2026-08-20",
    fechaLimite: "2026-09-03",
    fechaDevolucion: null,
    renovaciones: 0,
    codigoRetiro: "RET-590244",
    tieneReservas: false,
  },
];

export const SANCIONES: Penalty[] = [
  {
    id: "SAN-00028",
    loanId: "PRE-0993",
    userId: "u-ana",
    isbn: "9788478290745",
    monto: 2500,
    diasAtraso: 10,
    fechaLimiteOriginal: "2026-07-04",
    fechaDeteccion: "2026-07-14",
    fechaCobro: null,
    estado: "pendiente",
  },
  {
    id: "SAN-00029",
    loanId: "PRE-0994",
    userId: "u-camila",
    isbn: "9780134757599",
    monto: 2500,
    diasAtraso: 12,
    fechaLimiteOriginal: "2026-07-18",
    fechaDeteccion: "2026-07-30",
    fechaCobro: "2026-07-30",
    estado: "cobrada",
  },
  {
    id: "SAN-00030",
    loanId: "PRE-1006",
    userId: "u-martin",
    isbn: "9780201633610",
    monto: 2500,
    diasAtraso: 8,
    fechaLimiteOriginal: "2026-08-07",
    fechaDeteccion: "2026-08-15",
    fechaCobro: null,
    estado: "pendiente",
  },
  {
    id: "SAN-00031",
    loanId: "PRE-1001",
    userId: "u-ana",
    isbn: "9780132350884",
    monto: 2500,
    diasAtraso: 9,
    fechaLimiteOriginal: "2026-08-08",
    fechaDeteccion: "2026-08-17",
    fechaCobro: null,
    estado: "pendiente",
  },
];

export const NOTIFICACIONES: Notification[] = [
  {
    id: "NOT-006",
    userId: "u-ana",
    tipo: "vencimiento",
    titulo: "Préstamo próximo a vencer",
    cuerpo: "Introducción a los Algoritmos vence en 2 días en sede Monserrat.",
    fecha: "2026-08-25",
    leida: false,
  },
  {
    id: "NOT-005",
    userId: "u-ana",
    tipo: "vencimiento",
    titulo: "Préstamo vencido",
    cuerpo:
      "Domain-Driven Design venció el 23/08/2026. Devolvelo para evitar una sanción.",
    fecha: "2026-08-24",
    leida: true,
  },
  {
    id: "NOT-004",
    userId: "u-ana",
    tipo: "comprobante",
    titulo: "Comprobante disponible",
    cuerpo:
      "Tu préstamo PRE-1004 fue registrado. Retiralo en sede Monserrat hasta el 06/09/2026.",
    fecha: "2026-08-23",
    leida: true,
  },
  {
    id: "NOT-003",
    userId: "u-ana",
    tipo: "sancion",
    titulo: "Nueva sanción aplicada",
    cuerpo:
      "Se aplicó una multa de $2.500 por la devolución tardía del libro Clean Code.",
    fecha: "2026-08-17",
    leida: false,
  },
  {
    id: "NOT-002",
    userId: "u-ana",
    tipo: "comprobante",
    titulo: "Comprobante disponible",
    cuerpo:
      "Tu préstamo PRE-1003 fue registrado. Retiralo en sede Monserrat hasta el 28/08/2026.",
    fecha: "2026-08-14",
    leida: true,
  },
  {
    id: "NOT-001",
    userId: "u-ana",
    tipo: "comprobante",
    titulo: "Devolución registrada",
    cuerpo:
      "Recibimos Don't Make Me Think en sede Monserrat. El préstamo PRE-1005 quedó cerrado.",
    fecha: "2026-07-29",
    leida: true,
  },
  {
    id: "NOT-000",
    userId: "u-ana",
    tipo: "sancion",
    titulo: "Nueva sanción aplicada",
    cuerpo:
      "Se aplicó una multa de $2.500 por la devolución tardía del libro Ingeniería de Software.",
    fecha: "2026-07-14",
    leida: false,
  },
  {
    id: "NOT-010",
    userId: "u-martin",
    tipo: "sancion",
    titulo: "Nueva sanción aplicada",
    cuerpo:
      "Se aplicó una multa de $2.500 por la devolución tardía del libro Design Patterns.",
    fecha: "2026-08-15",
    leida: false,
  },
];

export const ACTIVIDAD: Activity[] = [
  {
    id: "ACT-004",
    tipo: "devolucion",
    texto: "Devolución registrada · Refactoring — Julián Pérez",
    fecha: "2026-08-26",
    hora: "11:20",
  },
  {
    id: "ACT-003",
    tipo: "prestamo",
    texto: "Nuevo préstamo · Database System Concepts — Ana García",
    fecha: "2026-08-23",
    hora: "09:45",
  },
  {
    id: "ACT-002",
    tipo: "sancion",
    texto: "Sanción generada · SAN-00031 — Ana García",
    fecha: "2026-08-17",
    hora: "08:10",
  },
  {
    id: "ACT-001",
    tipo: "alta_ejemplar",
    texto: "Alta de 3 ejemplares · Redes de Computadoras — Pinamar",
    fecha: "2026-08-15",
    hora: "16:30",
  },
];

/** Próximos números a usar al crear registros durante la demo. */
export const SECUENCIAS = {
  prestamo: 1009,
  sancion: 32,
};
