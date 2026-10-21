/* Usuarios simulados del CORE (copiados del seed de la Biblioteca; el contrato es el JSON). */
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export interface Lector {
  id: string; nombre: string; email: string; legajo: string; dni: string;
  rol: "estudiante" | "bibliotecario"; sedeDefault: string; iniciales: string; etiqueta: string;
}

export const LECTORES: Lector[] = [
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

export const lectorDto = (l: Lector) => ({
  id: l.id, name: l.nombre, email: l.email, studentId: l.legajo, nationalId: l.dni,
  role: l.rol === "bibliotecario" ? "librarian" : "student",
  defaultSiteId: l.sedeDefault, initials: l.iniciales, label: l.etiqueta,
});

const SAL = randomBytes(16);
const hashear = (password: string) => scryptSync(password, SAL, 32);
const HASH = hashear("uade1234"); // todos comparten la contrasena de la demo

export const passwordValida = (password: string): boolean => timingSafeEqual(hashear(password), HASH);
