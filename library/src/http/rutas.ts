import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { CATEGORIAS, hoyReal, SEDES } from "../dominio/reglas.js";
import type { Categoria, EstadoEjemplar, SedeId } from "../dominio/tipos.js";
import * as catalogo from "../servicios/catalogo.js";
import type { Contexto } from "../servicios/comun.js";
import * as notificaciones from "../servicios/notificaciones.js";
import * as panel from "../servicios/panel.js";
import * as prestamos from "../servicios/prestamos.js";
import * as sanciones from "../servicios/sanciones.js";
import type { DepsApp } from "./app.js";
import {
  activityDto, bookConStockDto, bookDto, copyDto, loanDto, loanSimpleDto, locationDto, notificationDto,
  indicatorsDto, penaltyDto, penaltySimpleDto, receiptDto, siteDto,
} from "./dto.js";
import { permitir, type Usuario } from "./middlewares.js";

const requerido = (campo: string) => `Falta ${campo}.`;
const texto = (campo: string) => z.string({ error: requerido(campo) }).trim().min(1, requerido(campo));
const sede = z.enum(["monserrat", "belgrano", "pinamar"], { error: "La sede debe ser monserrat, belgrano o pinamar." });
const categoria = z.enum(CATEGORIAS as [Categoria, ...Categoria[]], { error: "La categoría no es válida." });
const entero = (campo: string) => z.number({ error: `${campo} debe ser un número.` }).int(`${campo} debe ser un entero.`);

const datosLibro = {
  title: texto("el título"), author: texto("el autor"), publisher: texto("la editorial"),
  year: entero("El año"), category: categoria, description: z.string({ error: requerido("la descripción") }),
};
const altaLibro = z.object({ isbn: texto("el ISBN"), ...datosLibro, siteId: sede, quantity: entero("La cantidad") });
const edicionLibro = z.object(datosLibro);
const cambioActivo = z.object({ active: z.boolean({ error: "active debe ser verdadero o falso." }) });
const altaEjemplares = z.object({ siteId: sede, quantity: entero("La cantidad") });
const estadoEjemplar = z.object({
  status: z.enum(["available", "maintenance", "retired"], { error: "El estado debe ser available, maintenance o retired." }),
});
const nuevoPrestamo = z.object({ isbn: texto("el ISBN"), siteId: sede });
const lecturaNotificacion = z.object({ read: z.literal(true, { error: "read debe ser true." }) });

const bool = z.enum(["true", "false"]).optional().transform((v) => v === "true");
const consultaLibros = z.object({
  q: z.string().optional(), siteId: sede.optional(), category: z.string().optional(),
  inStock: bool, includeInactive: bool,
  sort: z.enum(["recent", "title", "availability"], { error: "sort no es válido." }).optional(),
});
const consultaPrestamos = z.object({
  q: z.string().optional(), siteId: sede.optional(),
  status: z.enum(["active", "overdue", "returned", "all"], { error: "status no es válido." }).optional(),
});
const consultaSanciones = z.object({
  q: z.string().optional(),
  status: z.enum(["all", "paid", "pending"], { error: "status no es válido." }).optional(),
});
const consultaNotificaciones = z.object({
  filter: z.enum(["all", "unread", "dueDates", "penalties"], { error: "filter no es válido." }).optional(),
});

const ESTADO_EJEMPLAR: Record<string, EstadoEjemplar> = { available: "disponible", maintenance: "mantenimiento", retired: "baja" };
const ORDEN = { recent: "recientes", title: "titulo", availability: "disponibilidad" } as const;
const ESTADO_PRESTAMO = { active: "activos", overdue: "vencidos", returned: "devueltos", all: "todos" } as const;
const ESTADO_SANCION = { all: "todas", paid: "cobradas", pending: "pendientes" } as const;
const FILTRO_NOTIF = { all: "todas", unread: "sin_leer", dueDates: "vencimientos", penalties: "sanciones" } as const;

const E = "estudiante" as const;
const B = "bibliotecario" as const;
const id = (req: Request, nombre: string) => String(req.params[nombre]);

export function crearRutas(deps: DepsApp): Router {
  const r = Router();
  const usuario = (res: Response) => res.locals.usuario as Usuario;
  const ctx = (res: Response): Contexto => ({
    repo: deps.repo, core: deps.core, hoy: (deps.hoy ?? hoyReal)(), correlationId: res.locals.correlationId,
  });
  /** Un estudiante solo ve lo propio. */
  const propio = (res: Response) => (usuario(res).rol === E ? usuario(res).id : undefined);

  /* --- Catalogo --- */
  r.get("/books", async (req, res) => {
    const q = consultaLibros.parse(req.query);
    const libros = await catalogo.listarLibros(deps.repo, {
      q: q.q, sede: q.siteId, categoria: q.category, soloStock: q.inStock,
      incluirInactivos: q.includeInactive, orden: q.sort && ORDEN[q.sort],
    });
    res.json(libros.map(bookConStockDto));
  });
  r.get("/books/:isbn", async (req, res) => {
    res.json(bookConStockDto(await catalogo.obtenerLibro(deps.repo, id(req, "isbn"))));
  });
  r.post("/books", permitir(B), async (req, res) => {
    const d = altaLibro.parse(req.body);
    const libro = await catalogo.crearLibro(deps.repo, {
      isbn: d.isbn, titulo: d.title, autor: d.author, editorial: d.publisher, anio: d.year,
      categoria: d.category, descripcion: d.description, sede: d.siteId, cantidad: d.quantity,
    }, ctx(res).hoy);
    res.status(201).json(bookConStockDto(await catalogo.obtenerLibro(deps.repo, libro.isbn)));
  });
  r.put("/books/:isbn", permitir(B), async (req, res) => {
    const d = edicionLibro.parse(req.body);
    const libro = await catalogo.editarLibro(deps.repo, id(req, "isbn"), {
      titulo: d.title, autor: d.author, editorial: d.publisher, anio: d.year, categoria: d.category, descripcion: d.description,
    });
    res.json(bookDto(libro));
  });
  r.patch("/books/:isbn", permitir(B), async (req, res) => {
    const { active } = cambioActivo.parse(req.body);
    res.json(bookDto(await catalogo.activarLibro(deps.repo, id(req, "isbn"), active)));
  });
  r.get("/books/:isbn/copies", permitir(B), async (req, res) => {
    res.json((await catalogo.listarEjemplares(deps.repo, id(req, "isbn"))).map(copyDto));
  });
  r.post("/books/:isbn/copies", permitir(B), async (req, res) => {
    const d = altaEjemplares.parse(req.body);
    const nuevos = await catalogo.agregarEjemplares(deps.repo, id(req, "isbn"), d.siteId, d.quantity, ctx(res).hoy);
    res.status(201).json(nuevos.map(copyDto));
  });
  r.patch("/books/:isbn/copies/:code", permitir(B), async (req, res) => {
    const { status } = estadoEjemplar.parse(req.body);
    res.json(copyDto(await catalogo.cambiarEstadoEjemplar(deps.repo, id(req, "isbn"), id(req, "code"), ESTADO_EJEMPLAR[status])));
  });

  /* --- Referencias --- */
  r.get("/categories", async (_req, res) => { res.json(await catalogo.categorias(deps.repo)); });
  r.get("/sites", (_req, res) => { res.json(SEDES.map(siteDto)); });
  r.get("/locations", async (_req, res) => { res.json((await deps.repo.ubicaciones()).map(locationDto)); });

  /* --- Prestamos --- */
  r.get("/loans", async (req, res) => {
    const q = consultaPrestamos.parse(req.query);
    const lista = await prestamos.listarPrestamos(ctx(res), {
      q: q.q, sede: q.siteId, estado: q.status && ESTADO_PRESTAMO[q.status], userId: propio(res),
    });
    res.json(lista.map(loanDto));
  });
  r.get("/loans/:id", async (req, res) => {
    res.json(loanDto(await prestamos.obtenerPrestamo(ctx(res), id(req, "id"), propio(res))));
  });
  r.post("/loans", permitir(E), async (req, res) => {
    const d = nuevoPrestamo.parse(req.body);
    res.status(201).json(loanSimpleDto(await prestamos.solicitarPrestamo(ctx(res), d.isbn, d.siteId as SedeId, usuario(res).id)));
  });
  r.post("/loans/:id/renew", permitir(E), async (req, res) => {
    res.json(loanSimpleDto(await prestamos.renovarPrestamo(ctx(res), id(req, "id"), usuario(res).id)));
  });
  r.post("/loans/:id/return", permitir(B), async (req, res) => {
    const { prestamo, sancion } = await prestamos.devolverPrestamo(ctx(res), id(req, "id"));
    res.json({ loan: loanSimpleDto(prestamo), penalty: sancion ? penaltySimpleDto(sancion) : null });
  });

  /* --- Sanciones --- */
  r.get("/penalties", async (req, res) => {
    const q = consultaSanciones.parse(req.query);
    const lista = await sanciones.listarSanciones(ctx(res), { q: q.q, estado: q.status && ESTADO_SANCION[q.status], userId: propio(res) });
    res.json(lista.map(penaltyDto));
  });
  r.get("/penalties/:id", async (req, res) => {
    res.json(penaltyDto(await sanciones.obtenerSancion(ctx(res), id(req, "id"), propio(res))));
  });
  r.post("/penalties/:id/payments", permitir(E), async (req, res) => {
    res.status(201).json(receiptDto(await sanciones.pagarSancion(ctx(res), id(req, "id"), usuario(res).id)));
  });

  /* --- Notificaciones (del estudiante) --- */
  r.get("/notifications", permitir(E), async (req, res) => {
    const { filter = "all" } = consultaNotificaciones.parse(req.query);
    res.json((await notificaciones.listarNotificaciones(deps.repo, usuario(res).id, FILTRO_NOTIF[filter])).map(notificationDto));
  });
  r.post("/notifications/read-all", permitir(E), async (_req, res) => {
    await notificaciones.marcarTodasLeidas(deps.repo, usuario(res).id);
    res.json((await notificaciones.listarNotificaciones(deps.repo, usuario(res).id)).map(notificationDto));
  });
  r.patch("/notifications/:id", permitir(E), async (req, res) => {
    lecturaNotificacion.parse(req.body);
    res.json(notificationDto(await notificaciones.marcarLeida(deps.repo, usuario(res).id, id(req, "id"))));
  });

  /* --- Panel --- */
  r.get("/indicators", permitir(B), async (req, res) => {
    const { siteId } = z.object({ siteId: sede.optional() }).parse(req.query);
    res.json(indicatorsDto(await panel.indicadores(deps.repo, siteId ?? "todas", ctx(res).hoy)));
  });
  r.get("/activities", permitir(B), async (_req, res) => {
    res.json((await panel.actividadReciente(deps.repo)).map(activityDto));
  });

  return r;
}
