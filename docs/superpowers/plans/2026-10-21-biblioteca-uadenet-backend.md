# Biblioteca UADEnet — Aplicación completa: plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convertir el frontend con store en memoria en una app completa: Biblioteca (backend real), CORE y Backoffice simulados, integrados por REST vía Gateway y por RabbitMQ.

**Architecture:** Monorepo con npm workspaces y cuatro componentes que no se importan código entre sí: `frontend/` (Next.js actual), `core/` (login JWT, Gateway, billetera, eventos, usuarios), `library/` (rutas → servicios → repositorios en memoria detrás de interfaces) y `backoffice/` (CLI que publica en RabbitMQ). Los contratos viven en `library/openapi.yaml` y `docs/integracion.md`.

**Tech Stack:** Node 22, TypeScript 5.9 strict, Express 5, zod, jsonwebtoken, amqplib, mariadb (conector oficial), swagger-ui-express + yaml, cors, tsx, `node:test`, concurrently, RabbitMQ 3.13 y MariaDB 11.4 (Docker), Next.js 15 / React 19.

**Spec:** `docs/superpowers/specs/2026-10-21-biblioteca-uadenet-backend-design.md`, que hay que leer junto con este plan.

## Global Constraints

- Ningún componente importa código de otro. Se copian los tipos que hagan falta; el contrato es el JSON.
- Identificadores y comentarios en castellano sin acentos; textos de interfaz y mensajes de error en castellano rioplatense ("Tenés", "Regularizá"). Copiar los mensajes de error **literalmente** de `src/lib/api/*` actuales.
- API de la Biblioteca: prefijo `/api/v1/library`, recursos en inglés, plural y minúscula. JSON con keys en inglés lowerCamelCase y **fechas como Unix timestamp en segundos** (medianoche local para fechas sin hora). POST/PUT/PATCH devuelven el recurso. Errores: `{ "code": "UPPER_SNAKE", "message": "<texto para pantalla>" }` con el status HTTP correspondiente.
- Reglas: préstamo 14 días; sanción con ≥ 8 días de atraso; renovación +3 días, máx. 2; próximo a vencer ≤ 3 días; ISBN de 10 a 13 dígitos; multa inicial 2500 ARS.
- Puertos por defecto: frontend 3000, core 4000, library 4001 (escucha solo en `127.0.0.1`), RabbitMQ 5672 / UI 15672. Toda configuración por variables de entorno con `.env.example` versionado.
- Contraseña de todos los usuarios simulados: `uade1234`. Dominio obligatorio: `@uade.edu.ar`.
- Headers del Gateway hacia la Biblioteca: `X-User-Id`, `X-User-Roles` (`student` | `librarian`), `X-User-Permissions`, `X-Correlation-Id`, `X-Gateway-Key`.
- Contratos de la planilla con su estructura exacta: `POST /internal/v1/wallets/{userId}/debits` `{amount:"2500.00", currency:"ARS", concept:"LIBRARY_FINE", sourceModule:"library", externalReference:"penalty/{id}"}`; `POST /internal/v1/events` `{eventType:"library.penalty.applied.v1", source:"library", subject:"user/{userId}", data:{userId, loanId, daysLate, amount, currency}}`; mensajes `backoffice.rate.changed.v1` y `backoffice.location.upserted.v1`.
- Ids legibles (`PRE-1003`, `SAN-00031`, `u-ana`, sedes `monserrat|belgrano|pinamar`).
- No agregar dependencias fuera de las del Tech Stack.
- Base de datos: **MariaDB** (decisión del usuario). El `Repositorio` es asíncrono en todas sus operaciones; el de memoria existe para tests y se implementa primero, MariaDB llega en la Task 12 (orden de ejecución: Tasks 1–11, después 12).
- Cada task termina con `npx tsc --noEmit` limpio en los componentes que tocó. La única excepción es la Task 9: puede dejar errores solo en las pantallas que todavía usan `lib/store`, y la Task 10 los cierra.

## Review Focus

1. **Un estudiante pide el préstamo, la sanción o el pago de otro** (cambiando el id en la URL): debe recibir 404 `NOT_FOUND`, nunca los datos ajenos. El test va en la Task 5.
2. **Doble clic en "Pagar"**: dos `POST /penalties/{id}/payments` seguidos. La billetera debita una sola vez (idempotencia por `externalReference`) y el segundo pedido devuelve 409 "Esta multa ya fue abonada.". Los tests van en las Tasks 4 y 6.
3. **Dos pedidos por el último ejemplar disponible**: el segundo recibe el error "No hay ejemplares disponibles…" y el ejemplar no queda asignado dos veces. El test va en la Task 4.
4. **Token vencido o inválido**: el Gateway responde 401 y el frontend vuelve al login sin dejar una pantalla en blanco. Los tests van en la Task 6 (Gateway) y la verificación en la Task 9.
5. **Biblioteca caída con el CORE arriba**: el Gateway responde 502 `{code:"LIBRARY_UNAVAILABLE"}` y la pantalla muestra el mensaje. **RabbitMQ caído**: la Biblioteca arranca igual. Los tests van en la Task 6 y la Task 8.

---

## Mapa de archivos

```
package.json                      workspaces + scripts dev/test/typecheck
docker-compose.yml                rabbitmq:3-management
docs/integracion.md               tabla de contratos (Task 10)
frontend/                         el Next.js actual (git mv desde la raíz)
  src/lib/api/http.ts             fetch al CORE, token, errores, invalidación
  src/lib/api/adaptadores.ts      DTO inglés/timestamps → tipos de domain/types.ts
  src/lib/api/useApi.ts           hook de lectura con recarga por invalidación
  src/lib/api/sesion.tsx          SesionProvider + useUsuario/useUsuarioActual/useRol
core/src/
  usuarios.ts                     usuarios simulados + saldos
  auth.ts                         login + firma/verificación JWT
  billetera.ts                    débitos idempotentes
  eventos.ts                      registro de eventos
  gateway.ts                      proxy /api/v1/library/*
  app.ts / server.ts              armado de Express / arranque
library/src/
  dominio/tipos.ts, reglas.ts     copiados de frontend/src/lib/domain y recortados
  datos/repositorio.ts            interfaz Repositorio
  datos/memoria.ts                implementación en memoria
  datos/seed.ts                   seed movido + desplazamiento de fechas
  integracion/core.ts             interfaz PuertoCore + CoreHttp (Adapter)
  integracion/backoffice.ts       manejo de mensajes (puro) + consumidor AMQP
  servicios/*.ts                  catalogo, prestamos, sanciones, notificaciones, panel
  http/*.ts                       app, middlewares, rutas, dto, errores
  openapi.yaml
  server.ts
backoffice/src/publicar.ts        CLI
```

---

### Task 1: Monorepo, RabbitMQ y frontend movido

**Files:**
- Move: todo el Next.js de la raíz → `frontend/` (`src/`, `next.config.ts`, `next-env.d.ts`, `postcss.config.mjs`, `eslint.config.mjs`, `tsconfig.json`, `package.json`, `package-lock.json`). Se borran `tsconfig.tsbuildinfo` y `node_modules` de la raíz.
- Create: `package.json` (raíz), `docker-compose.yml`, `.gitignore` (agregar `.env`, `**/node_modules`, `**/.next`)
- Modify: `README.md` (rutas nuevas, solo la sección "Cómo levantarlo")

**Interfaces:**
- Produces: workspaces `frontend`, `core`, `library`, `backoffice`. Scripts raíz: `dev` (concurrently: frontend, core, library), `test` (`npm test --workspaces --if-present`), `typecheck` (`npm run typecheck --workspaces --if-present`).

- [ ] **Step 1:** Usar `git mv` para mover los archivos a `frontend/` y cambiar el `name` de `frontend/package.json` a `@uadenet/frontend`. Crear el `package.json` raíz con `"private": true`, `"workspaces": ["frontend","core","library","backoffice"]` y `concurrently` como devDependency. `docker-compose.yml` con el servicio `rabbitmq` de la imagen `rabbitmq:3-management` y los puertos `5672:5672` y `15672:15672`.
- [ ] **Step 2:** Correr `npm install` en la raíz y después `npm run build -w @uadenet/frontend`. Esperado: el build sale bien, igual que antes.
- [ ] **Step 3:** Commit `chore: monorepo con npm workspaces y frontend en frontend/`.

---

### Task 2: Biblioteca — dominio, repositorio en memoria y seed relativo

**Files:**
- Create: `library/package.json` (`@uadenet/library`, `"type": "module"`, scripts `dev: tsx watch src/server.ts`, `test: node --import tsx --test "src/**/*.test.ts"`, `typecheck: tsc --noEmit`), `library/tsconfig.json` (strict, `module`/`moduleResolution` `NodeNext`, target ES2022), `library/.env.example`
- Create: `library/src/dominio/tipos.ts`: copia de `src/lib/domain/types.ts`, más `Location { locationId, siteId: SedeId, name, capacity, status }` y `Tarifa { monto: number, vigenteDesde: FechaISO }`. `User` sale del dominio: la Biblioteca usa `Lector { id, nombre, email, legajo, dni, rol, sedeDefault, iniciales, etiqueta }` y lo obtiene del CORE.
- Create: `library/src/dominio/reglas.ts`: copia de las reglas de negocio de `rules.ts`, sin formatos de pantalla ni validaciones de formulario de UI (`validarIsbn` se queda). `HOY` desaparece: cada función que la usaba recibe `hoy: FechaISO` sin valor por defecto. Se borra `MONTO_MULTA` y se agrega `export const MONTO_MULTA_INICIAL = 2500`. Agregar `export function hoyReal(): FechaISO` (la fecha local de `new Date()`).
- Create: `library/src/datos/repositorio.ts`, `library/src/datos/memoria.ts`, `library/src/datos/seed.ts`
- Test: `library/src/datos/memoria.test.ts`, `library/src/datos/seed.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // datos/repositorio.ts — TODO es asíncrono: la implementación real es MariaDB (Task 12)
  export interface Repositorio {
    libros(): Promise<Book[]>; libro(isbn: string): Promise<Book | undefined>;
    guardarLibro(libro: Book): Promise<void>;
    ejemplares(isbn?: string): Promise<Copy[]>; guardarEjemplares(copias: Copy[]): Promise<void>;
    prestamos(): Promise<Loan[]>; prestamo(id: string): Promise<Loan | undefined>; guardarPrestamo(l: Loan): Promise<void>;
    guardarSancion(p: Penalty): Promise<void>;
    sanciones(): Promise<Penalty[]>; sancion(id: string): Promise<Penalty | undefined>; sancionDe(loanId: string): Promise<Penalty | undefined>;
    notificaciones(userId: string): Promise<Notification[]>; guardarNotificaciones(n: Notification[]): Promise<void>;
    actividad(): Promise<Activity[]>; registrarActividad(a: Activity): Promise<void>;
    tarifas(): Promise<Tarifa[]>; agregarTarifa(t: Tarifa): Promise<void>;
    ubicaciones(): Promise<Location[]>; guardarUbicacion(l: Location): Promise<void>;
    siguienteId(tipo: "prestamo" | "sancion"): Promise<string>;   // "PRE-1009", "SAN-00032"
    /**
     * Unidad de trabajo: todo lo que se escribe adentro se aplica junto o nada
     * (en MariaDB, una transacción). Las transacciones se SERIALIZAN: dos pedidos
     * por el último ejemplar no pueden leer el mismo estado.
     */
    transaccion<T>(trabajo: (repo: Repositorio) => Promise<T>): Promise<T>;
  }
  export function crearRepositorioEnMemoria(hoy: FechaISO): Repositorio; // en memoria.ts, sembrado y desplazado
  ```
  Tipos de guardado: `guardarX` hace upsert por clave primaria.
  ```ts
  // datos/seed.ts
  export const FECHA_MAQUETA = "2026-08-26";
  export function sembrar(hoy: FechaISO): DatosSeed; // todas las FechaISO del seed corridas diasEntre(FECHA_MAQUETA, hoy) días
  export const LECTORES: Lector[]; // los USUARIOS del seed actual; los usa core/ (copiados)
  ```

- [ ] **Step 1: Tests que fallan**
  ```ts
  Estos tests de contrato se escriben como `export function contratoRepositorio(nombre: string, crear: (hoy: FechaISO) => Promise<Repositorio>)` en `library/src/datos/contrato.ts`, para que la Task 12 los corra contra MariaDB. `memoria.test.ts` los invoca con `async (hoy) => crearRepositorioEnMemoria(hoy)`.
  ```ts
  test("seed desplazado: PRE-1003 vence en 2 días y PRE-1001 lleva 18 de atraso", async () => {
    const hoy = "2026-11-02";
    const repo = await crear(hoy);
    assert.equal(diasRestantes((await repo.prestamo("PRE-1003"))!, hoy), 2);
    assert.equal(diasAtraso((await repo.prestamo("PRE-1001"))!, hoy), 18);
  });
  test("siguienteId continúa la secuencia del seed", async () => {
    const repo = await crear("2026-08-26");
    assert.equal(await repo.siguienteId("prestamo"), "PRE-1009");
    assert.equal(await repo.siguienteId("sancion"), "SAN-00032");
  });
  test("transaccion descarta todo si el trabajo lanza", async () => {
    const repo = await crear("2026-08-26");
    const antes = (await repo.prestamos()).length;
    await assert.rejects(repo.transaccion(async (r) => { await r.guardarPrestamo({ ...(await r.prestamo("PRE-1003"))!, id: "PRE-X" }); throw new Error("x"); }));
    assert.equal((await repo.prestamos()).length, antes);
  });
  test("transacciones concurrentes se serializan", async () => {
    const repo = await crear("2026-08-26");
    const orden: string[] = [];
    await Promise.all([
      repo.transaccion(async () => { orden.push("a1"); await new Promise((r) => setTimeout(r, 20)); orden.push("a2"); }),
      repo.transaccion(async () => { orden.push("b1"); orden.push("b2"); }),
    ]);
    assert.deepEqual(orden, ["a1", "a2", "b1", "b2"]);
  });
  test("tarifa inicial 2500 vigente desde la fecha de arranque", async () => {
    assert.deepEqual(await (await crear("2026-08-26")).tarifas(), [{ monto: 2500, vigenteDesde: "2026-08-26" }]);
  });
  ```
- [ ] **Step 2:** Correr `npm test -w @uadenet/library`. Esperado: FAIL porque los módulos todavía no existen.
- [ ] **Step 3:** Implementar. **Copiar** (no mover: el frontend lo usa hasta la Task 10) `frontend/src/lib/store/seed.ts` a `library/src/datos/seed.ts` y adaptarlo: cambiar los imports, renombrar `USUARIOS` a `LECTORES` y desplazar las fechas. `transaccion` en memoria: encadena las transacciones en una cola de promesas (mutex), y dentro de cada una hace un `structuredClone` del estado, ejecuta el trabajo y, si lanza, restaura el clon. Los datos devueltos por las lecturas son copias, nunca referencias al estado interno.
- [ ] **Step 4:** Correr `npm test -w @uadenet/library`. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(library): dominio, repositorio en memoria y seed relativo a hoy`.

---

### Task 3: Biblioteca — puerto del CORE y servicios de catálogo y notificaciones

**Files:**
- Create: `library/src/integracion/core.ts` (solo la interfaz y un `CoreFalso` para tests; la versión HTTP llega en la Task 7)
- Create: `library/src/servicios/errores.ts`, `servicios/catalogo.ts`, `servicios/notificaciones.ts`, `servicios/panel.ts`
- Test: `library/src/servicios/catalogo.test.ts`

**Interfaces:**
- Produces:
  ```ts
  // integracion/core.ts
  export interface PuertoCore {
    lectores(ids: string[], correlationId: string): Promise<Lector[]>;
    buscarLectores(q: string, correlationId: string): Promise<Lector[]>;
    debitar(userId: string, monto: number, penaltyId: string, correlationId: string): Promise<{ operacion: string }>;
    publicarEvento(evento: EventoSancion, correlationId: string): Promise<void>;
  }
  export class SaldoInsuficiente extends Error {}
  export class CoreNoDisponible extends Error {}
  export class CoreFalso implements PuertoCore { saldos: Map<string, number>; eventos: EventoSancion[]; debitos: string[]; /* externalReference ya debitados */ }
  ```
  ```ts
  // servicios/errores.ts
  export class ErrorNegocio extends Error { constructor(readonly code: string, mensaje: string, readonly status = 400) }
  ```
  - **Todas las funciones de servicio son `async` y devuelven `Promise<...>`** del tipo indicado, porque el repositorio es asíncrono.
  - `catalogo.ts`: `listarLibros(repo, filtro: FiltroCatalogo): BookWithStock[]`, `obtenerLibro(repo, isbn): BookWithStock`, `crearLibro(repo, datos: AltaLibro, hoy): Book`, `editarLibro(repo, isbn, cambios: Partial<Omit<Book,"isbn"|"activo">>): Book`, `activarLibro(repo, isbn, activo: boolean): Book`, `listarEjemplares(repo, isbn): Copy[]`, `agregarEjemplares(repo, isbn, sede, cantidad, hoy): Copy[]`, `cambiarEstadoEjemplar(repo, isbn, codigo, estado): Copy`, `categorias(repo): string[]`. `FiltroCatalogo` y `AltaLibro` tienen la misma forma que en `frontend/src/lib/api/books.ts`.
  - `notificaciones.ts`: `listarNotificaciones(repo, userId, filtro: FiltroNotificaciones)`, `marcarLeida(repo, userId, id): Notification`, `marcarTodasLeidas(repo, userId): void`, `notificar(repo, userId, tipo, titulo, cuerpo, hoy): void`.
  - `panel.ts`: `indicadores(repo, sede: SedeId | "todas", hoy): Indicadores`, `actividadReciente(repo): Activity[]`.
  - La lógica sale de los cuerpos actuales de `frontend/src/lib/api/books.ts`, `notifications.ts`, `internal.ts` y `lib/store/selectors.ts`, con los mismos mensajes. Cada `ApiError(msg, status)` pasa a ser `ErrorNegocio(code, msg, status)`.

- [ ] **Step 1: Tests que fallan**
  ```ts
  test("crearLibro rechaza ISBN repetido con 409 BOOK_EXISTS", ...)       // assert.throws, err.status === 409, err.code === "BOOK_EXISTS"
  test("crearLibro con ISBN de 9 dígitos → 400 INVALID_ISBN", ...)
  test("crearLibro genera N ejemplares disponibles en la sede y una actividad alta_ejemplar", ...)
  test("listarLibros con soloStock y sede filtra por porSede[sede] > 0", ...)
  test("marcarLeida de una notificación de otro usuario → 404 NOT_FOUND", ...)
  ```
- [ ] **Step 2:** Correr `npm test -w @uadenet/library`. Esperado: FAIL.
- [ ] **Step 3:** Implementar los archivos listados.
- [ ] **Step 4:** Correr los tests. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(library): catálogo, notificaciones e indicadores`.

---

### Task 4: Biblioteca — préstamos, sanciones, pagos y detección de atrasos

**Files:**
- Create: `library/src/servicios/prestamos.ts`, `servicios/sanciones.ts`, `servicios/deteccion.ts`
- Test: `library/src/servicios/prestamos.test.ts`, `servicios/sanciones.test.ts`

**Interfaces:**
- Consumes: `Repositorio`, `PuertoCore`, `CoreFalso`, `ErrorNegocio`, `notificar` (Tasks 2–3).
- Produces:
  ```ts
  export interface Contexto { repo: Repositorio; core: PuertoCore; hoy: FechaISO; correlationId: string }
  // prestamos.ts
  listarPrestamos(ctx, filtro: FiltroPrestamos): Promise<LoanView[]>   // q busca también por DNI/legajo vía core.lectores
  obtenerPrestamo(ctx, id, userId?: string): Promise<LoanView>         // userId presente = estudiante: si no es suyo → 404
  solicitarPrestamo(ctx, isbn, sede, userId): Promise<Loan>
  renovarPrestamo(ctx, id, userId): Promise<Loan>
  devolverPrestamo(ctx, id): Promise<{ prestamo: Loan; sancion: Penalty | null }>
  // sanciones.ts
  montoVigente(repo, hoy): Promise<number>                             // tarifa con vigenteDesde <= hoy más reciente
  aplicarSancion(ctx, prestamo: Loan): Promise<Penalty | null>         // null si ya tenía o no corresponde; publica evento una vez
  listarSanciones(ctx, filtro: FiltroSanciones): Promise<PenaltyView[]>
  obtenerSancion(ctx, id, userId?: string): Promise<PenaltyView>
  pagarSancion(ctx, id, userId): Promise<PaymentReceipt>
  // deteccion.ts
  detectarAtrasos(ctx): Promise<Penalty[]>                             // recorre préstamos abiertos
  ```
  `LoanView` y `PenaltyView` tienen la forma de `tipos.ts`, salvo que `estudiante` es un `Lector`.

- [ ] **Step 1: Tests que fallan** (en todos, `hoy` es la fecha del seed y `core = new CoreFalso()`)
  ```ts
  test("solicitar con sanción pendiente → SANCTION_PENDING con el mensaje 'Tenés una sanción pendiente de pago…'", ...)
  test("último ejemplar: dos solicitudes lanzadas a la vez con Promise.allSettled → una fulfilled, otra rejected NO_COPIES, y el ejemplar asignado a un solo préstamo", ...)
  test("renovar suma 3 días; la tercera renovación falla con RENEWAL_LIMIT", ...)
  test("renovar préstamo ajeno → 404 NOT_FOUND", ...)
  test("devolver con 9 días de atraso crea sanción de 2500, libera el ejemplar y publica 1 evento con subject 'user/<id>' y data.amount '2500.00'", ...)
  test("detectarAtrasos sanciona un préstamo abierto con 8 días y no duplica si corre dos veces (1 sanción, 1 evento)", ...)
  test("devolver un préstamo ya sancionado por la detección no crea otra sanción", ...)
  test("si publicarEvento lanza CoreNoDisponible, la sanción igual queda guardada", ...)
  test("montoVigente ignora una tarifa con vigenteDesde futuro y la toma cuando llega", ...)
  test("pagar con saldo suficiente: cobrada, comprobante con monto y operacion, core.debitos contiene 'penalty/SAN-…'", ...)
  test("pagar dos veces → la segunda 409 ALREADY_PAID 'Esta multa ya fue abonada.' y un solo débito", ...)
  test("pagar sin saldo → 409 INSUFFICIENT_FUNDS y la sanción sigue pendiente", ...)
  test("pagar con CORE caído → 503 CORE_UNAVAILABLE y la sanción sigue pendiente", ...)
  ```
- [ ] **Step 2:** Correr los tests. Esperado: FAIL.
- [ ] **Step 3:** Implementar. Las lecturas que deciden **y** las escrituras de `solicitarPrestamo`, `renovarPrestamo`, `devolverPrestamo`, `aplicarSancion` y el marcado de cobro de `pagarSancion` van dentro de `repo.transaccion` (leer el ejemplar disponible fuera de la transacción rompe la garantía del último ejemplar). Las llamadas al CORE quedan **fuera** de la transacción: en el pago, primero el débito y después marcar cobrada; en la sanción, primero guardar y después publicar, envolviendo la publicación en try/catch con `console.error` que incluya el correlationId. La sanción congela `diasAtraso` y `monto = montoVigente(repo, hoy)`. Mensaje de saldo insuficiente: "No tenés saldo suficiente en tu cuenta UADEnet para pagar esta multa.". Mensaje de CORE caído: "No pudimos procesar el pago en este momento. Intentá de nuevo en unos minutos.".
- [ ] **Step 4:** Correr los tests. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(library): préstamos, sanciones, pagos y detección de atrasos`.

---

### Task 5: Biblioteca — capa HTTP, DTO, autorización y Swagger

**Files:**
- Create: `library/src/http/app.ts`, `http/middlewares.ts`, `http/dto.ts`, `http/rutas.ts`, `library/openapi.yaml`
- Test: `library/src/http/app.test.ts` (levanta `crearApp` en un puerto efímero y usa `fetch`)

**Interfaces:**
- Consumes: todos los servicios (Tasks 3–4).
- Produces: `crearApp(deps: { repo: Repositorio; core: PuertoCore; gatewayKey: string; hoy?: () => FechaISO }): express.Express`.

**DTO** (`dto.ts`, de dominio a JSON, con fechas en segundos Unix de la medianoche local):

| Dominio | DTO |
|---|---|
| `Book` | `{ isbn, title, author, publisher, year, category, description, active }` + en `BookWithStock`: `stock: { total, available, loaned, bySite: { monserrat, belgrano, pinamar } }` |
| `Copy` | `{ code, isbn, siteId, status }`, status `available\|loaned\|reserved\|maintenance\|retired` |
| `Lector` | `{ id, name, email, studentId, nationalId, role: student\|librarian, defaultSiteId, initials, label }` |
| `LoanView` | `{ id, isbn, copyCode, userId, siteId, loanedAt, dueAt, returnedAt, renewals, pickupCode, hasReservations, status: active\|dueSoon\|overdue\|penalized\|returned, daysLeft, daysLate, book, student, penalty }` |
| `PenaltyView` | `{ id, loanId, userId, isbn, amount, currency:"ARS", daysLate, originalDueAt, detectedAt, paidAt, status: pending\|paid, book, student }` |
| `Notification` | `{ id, type: penalty\|dueDate\|receipt, title, body, createdAt, read }` |
| `Activity` | `{ id, type: return\|loan\|penalty\|copyAdded, text, createdAt }` (createdAt incluye la hora) |
| `PaymentReceipt` | `{ operationId, penaltyId, amount, currency, method:"institutionalBalance", paidAt }` |

El cuerpo de entrada usa los mismos nombres en inglés. Todo se valida con zod; si falla → 400 `VALIDATION_ERROR` con el primer mensaje.

**Rutas** (prefijo `/api/v1/library`; E = student, B = librarian):

| Método y ruta | Rol | Servicio |
|---|---|---|
| `GET /books?q&siteId&category&inStock&includeInactive&sort=recent\|title\|availability` | E,B | listarLibros |
| `GET /books/{isbn}` · `POST /books` · `PUT /books/{isbn}` · `PATCH /books/{isbn}` `{active}` | E,B / B / B / B | catálogo |
| `GET /books/{isbn}/copies` · `POST /books/{isbn}/copies` `{siteId, quantity}` · `PATCH /books/{isbn}/copies/{code}` `{status}` | B | catálogo |
| `GET /categories` · `GET /sites` · `GET /locations` | E,B | |
| `GET /loans?q&status=active\|overdue\|returned\|all&siteId` | E (forzado a los propios), B | listarPrestamos |
| `GET /loans/{id}` · `POST /loans` `{isbn, siteId}` · `POST /loans/{id}/renew` | E,B / E / E | |
| `POST /loans/{id}/return` → `{ loan, penalty }` | B | devolverPrestamo |
| `GET /penalties?status=all\|paid\|pending&q` · `GET /penalties/{id}` | E (propias), B | |
| `POST /penalties/{id}/payments` → receipt (201) | E | pagarSancion |
| `GET /notifications?filter=all\|unread\|dueDates\|penalties` · `PATCH /notifications/{id}` `{read:true}` · `POST /notifications/read-all` | E | |
| `GET /indicators?siteId` · `GET /activities` | B | panel |
| `GET /docs` | público dentro de localhost | Swagger UI de `openapi.yaml` |

**Middlewares:**
- `X-Gateway-Key` distinto del configurado → 401 `GATEWAY_REQUIRED`.
- Falta `X-User-Id` → 401.
- Rol no permitido → 403 `FORBIDDEN`.
- Cada request se loguea en una línea: `[library] <correlationId> <método> <ruta> <status> <ms>ms`.
- Un `ErrorNegocio` devuelve su `status` con `{code, message}`. `SaldoInsuficiente` y `CoreNoDisponible` ya llegan traducidos desde la Task 4. Cualquier otra excepción → 500 `INTERNAL_ERROR` "Ocurrió un error inesperado. Intentá de nuevo.".

- [ ] **Step 1: Tests que fallan**
  ```ts
  test("sin X-Gateway-Key → 401 GATEWAY_REQUIRED", ...)
  test("estudiante en GET /indicators → 403 FORBIDDEN", ...)
  test("GET /loans como u-ana devuelve solo los préstamos de u-ana con fechas numéricas", ...)  // typeof dueAt === "number"
  test("GET /loans/{id de otro} como estudiante → 404", ...)
  test("GET /penalties/{id de otro} y POST …/payments ajeno → 404", ...)
  test("POST /books con body inválido → 400 VALIDATION_ERROR", ...)
  test("POST /loans devuelve 201 con el préstamo creado", ...)
  test("GET /docs responde 200 text/html", ...)
  ```
- [ ] **Step 2:** Correr los tests. Esperado: FAIL.
- [ ] **Step 3:** Implementar. Escribir `openapi.yaml` (OpenAPI 3.0) con todas las rutas de la tabla y los esquemas DTO.
- [ ] **Step 4:** Correr los tests. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(library): API REST v1 con autorización por rol y Swagger`.

---

### Task 6: CORE simulado

**Files:**
- Create: `core/package.json` (`@uadenet/core`, igual configuración que library), `core/tsconfig.json`, `core/.env.example` (`PORT=4000`, `JWT_SECRET`, `GATEWAY_KEY`, `SERVICE_KEY`, `LIBRARY_URL=http://127.0.0.1:4001`, `FRONTEND_ORIGIN=http://localhost:3000`)
- Create: `core/src/usuarios.ts`, `auth.ts`, `billetera.ts`, `eventos.ts`, `gateway.ts`, `app.ts`, `server.ts`
- Test: `core/src/app.test.ts`

**Interfaces:**
- Produces (HTTP):
  - `POST /api/v1/auth/login` `{email, password}` → `{ token, user: LectorDto }`. Errores con el formato `{code, message}` y los mensajes de `frontend/src/lib/api/auth.ts`.
  - `GET /api/v1/wallets/me` (Bearer) → `{ balance: "5000.00", currency: "ARS" }`.
  - `ALL /api/v1/library/*splat`: Gateway. Bearer inválido o vencido → 401 `INVALID_TOKEN`. Biblioteca inalcanzable → 502 `{code:"LIBRARY_UNAVAILABLE", message:"La biblioteca no está disponible en este momento. Intentá de nuevo en unos minutos."}`. Reenvía el método, la query, el body y el `Content-Type`, saca `Authorization`, agrega `X-User-*`, `X-Gateway-Key` y `X-Correlation-Id` (reusa el entrante o genera `randomUUID()`), y devuelve el status y el body tal cual. Loguea `[core] <correlationId> → library <método> <ruta> <status>`.
  - `/internal/v1/*` exige `X-Service-Key`:
    - `GET /internal/v1/users?ids=a,b` · `GET /internal/v1/users?q=` → `LectorDto[]`;
    - `POST /internal/v1/wallets/{userId}/debits` (contrato de la planilla) → 201 `{ operationId, balance }`. Saldo insuficiente → 409 `INSUFFICIENT_FUNDS`. El mismo `externalReference` repetido → 200 con la misma `operationId`, sin volver a debitar;
    - `POST /internal/v1/events` → 202;
    - `GET /internal/v1/events` → lista.
- Usuarios: los `LECTORES` del seed (copiados de `library/src/datos/seed.ts`) con hash `scrypt` de `uade1234`. Saldos: `u-ana` 5000, `u-laura` 0, el resto 2500, salvo un estudiante con 0 para probar el rechazo; ese id va en el README.
- JWT HS256 con `sub`, `roles`, `permissions`, `exp` de 8 h. Permisos: student → `["library:read","library:loan","library:pay"]`; librarian → `["library:read","library:admin"]`.
- CORS solo para `FRONTEND_ORIGIN`, con los headers `Authorization`, `Content-Type` y `X-Correlation-Id`.

- [ ] **Step 1: Tests que fallan** (la Biblioteca se simula con un Express mínimo en un puerto efímero que devuelve los headers recibidos)
  ```ts
  test("login con mail no @uade.edu.ar → 400 con 'Usá tu mail institucional @uade.edu.ar.'", ...)
  test("login correcto devuelve token y user.role 'student' para ana", ...)
  test("gateway sin token → 401 INVALID_TOKEN; con token vencido → 401", ...)
  test("gateway reenvía X-User-Id, X-User-Roles, X-Gateway-Key, propaga X-Correlation-Id y no reenvía Authorization", ...)
  test("gateway con biblioteca apagada → 502 LIBRARY_UNAVAILABLE", ...)
  test("débito idempotente por externalReference: dos POST, saldo baja una vez", ...)
  test("débito sin saldo → 409 INSUFFICIENT_FUNDS", ...)
  test("/internal sin X-Service-Key → 401", ...)
  ```
- [ ] **Step 2:** Correr los tests. Esperado: FAIL.
- [ ] **Step 3:** Implementar. El Gateway usa `express.raw({ type: "*/*" })` y `fetch` de Node, sin librería de proxy. Agregar `core/README.md` con lo que expone, lo que consume y cómo correrlo.
- [ ] **Step 4:** Correr los tests. Esperado: PASS.
- [ ] **Step 5:** Commit `feat(core): CORE simulado con login JWT, gateway, billetera y eventos`.

---

### Task 7: Biblioteca — adapter HTTP al CORE y arranque

**Files:**
- Modify: `library/src/integracion/core.ts` (agregar `CoreHttp`)
- Create: `library/src/server.ts`, `library/README.md`
- Test: `library/src/integracion/core.test.ts` (contra un Express mínimo que imita las rutas internas)

**Interfaces:**
- Produces: `class CoreHttp implements PuertoCore { constructor(baseUrl: string, serviceKey: string) }`. Manda `X-Service-Key` y `X-Correlation-Id`, con timeout de 5 s (`AbortSignal.timeout`). Mapea 409 `INSUFFICIENT_FUNDS` → `SaldoInsuficiente`, y una red caída, un timeout o un 5xx → `CoreNoDisponible`. Formatea `amount` como `monto.toFixed(2)`.
- `server.ts` lee `PORT`, `CORE_URL`, `SERVICE_KEY`, `GATEWAY_KEY` y `RABBITMQ_URL`. Escucha en `127.0.0.1`. Corre `detectarAtrasos` al arrancar y después cada 1 h con `setInterval`.

- [ ] **Step 1: Tests que fallan**
  ```ts
  test("debitar envía el body exacto de la planilla", ...)  // deepEqual {amount:"2500.00",currency:"ARS",concept:"LIBRARY_FINE",sourceModule:"library",externalReference:"penalty/SAN-00031"}
  test("409 INSUFFICIENT_FUNDS → SaldoInsuficiente; servidor apagado → CoreNoDisponible", ...)
  test("publicarEvento envía eventType, source 'library', subject 'user/u-ana' y data.daysLate numérico", ...)
  ```
- [ ] **Step 2:** Correr los tests. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Correr los tests. Esperado: PASS. Después levantar el sistema con `npm run dev` y probar a mano: hacer login contra `:4000` con `curl` y pedir `GET :4000/api/v1/library/loans` con el Bearer. Esperado: 200 con los préstamos de Ana, y el mismo correlationId en los logs de core y de library.
- [ ] **Step 5:** Commit `feat(library): adapter HTTP al CORE, arranque y job de atrasos`.

---

### Task 8: RabbitMQ — consumidor de la Biblioteca y Backoffice simulado

**Files:**
- Create: `library/src/integracion/backoffice.ts`, `backoffice/package.json` (`@uadenet/backoffice`, scripts `publish:rate`, `publish:location` y `publish:invalid`), `backoffice/tsconfig.json`, `backoffice/src/publicar.ts`, `backoffice/README.md`
- Modify: `library/src/server.ts` (arranca el consumidor)
- Test: `library/src/integracion/backoffice.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type Resultado = "aplicado" | "ignorado" | "invalido";
  export function procesarMensaje(repo: Repositorio, routingKey: string, contenido: Buffer, hoy: FechaISO): Promise<Resultado>; // sin AMQP, testeable
  export function iniciarConsumidor(url: string, repo: Repositorio): void; // nunca lanza; reintenta cada 5 s
  ```
- Topología, declarada por `iniciarConsumidor`:
  - exchange topic `backoffice.events` (durable);
  - exchange `library.dlx` (fanout) → cola `library.dlq`;
  - cola `library.backoffice` (durable, `x-dead-letter-exchange: library.dlx`), con bind `backoffice.#`;
  - `prefetch(10)`.
- Resultados: `aplicado` e `ignorado` → `ack`; `invalido` → `nack(msg, false, false)`, que lo manda a la DLQ. Una excepción inesperada se trata como `invalido`.
- `publicar.ts` publica con `persistent: true`:
  - `publish:rate -- 3000 [YYYY-MM-DD]`;
  - `publish:location -- sede-monserrat "Biblioteca - PB" 120`;
  - `publish:invalid`, que manda un JSON roto.

- [ ] **Step 1: Tests que fallan**
  ```ts
  test("rate LIBRARY_LATE_FEE 3000 vigente hoy → aplicado y montoVigente === 3000", ...)
  test("rate con effectiveFrom futuro → aplicado, montoVigente sigue 2500", ...)
  test("rate con rateType distinto → ignorado, tarifas sin cambios", ...)
  test("rate con currency USD, amount 'abc' o JSON roto → invalido", ...)
  test("location con siteId 'sede-monserrat' → aplicado, ubicaciones()[0].siteId === 'monserrat'", ...)
  test("location con siteId 'sede-rosario' → invalido", ...)
  ```
- [ ] **Step 2:** Correr los tests. Esperado: FAIL.
- [ ] **Step 3:** Implementar. Cada mensaje procesado se loguea con `[library] backoffice <routingKey> <resultado>`.
- [ ] **Step 4:** Correr los tests. Esperado: PASS. Después probar a mano:
  - con `docker compose up -d` y `npm run dev`, correr `npm run publish:rate -w @uadenet/backoffice -- 3000`. Esperado: un log con `aplicado`;
  - correr `publish:invalid`. Esperado: el mensaje aparece en `library.dlq` en http://localhost:15672 (guest/guest);
  - con `docker compose stop`, levantar la Biblioteca. Esperado: arranca, la API responde y el log de reintento aparece cada 5 s.
- [ ] **Step 5:** Commit `feat: consumidor RabbitMQ con DLQ y Backoffice simulado`.

---

### Task 9: Frontend — cliente HTTP, sesión, adaptadores y `lib/api`

**Files:**
- Create: `frontend/src/lib/api/http.ts`, `adaptadores.ts`, `useApi.ts`, `sesion.tsx`, `frontend/.env.example` (`NEXT_PUBLIC_CORE_URL=http://localhost:4000`)
- Modify (reescritura de cuerpos, mismas firmas exportadas salvo lo indicado): `frontend/src/lib/api/auth.ts`, `books.ts`, `loans.ts`, `penalties.ts`, `notifications.ts`, `errors.ts`
- Delete: `frontend/src/lib/api/internal.ts`
- Modify: `frontend/src/lib/domain/rules.ts`: `HOY` pasa a ser `export const HOY = aISO(new Date())`; se agrega el comentario `// shortcut: se calcula al cargar la página, queda viejo si la pestaña cruza la medianoche`

**Interfaces:**
- Produces:
  ```ts
  // http.ts
  export function pedir<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T>; // ruta relativa a /api/v1/library o absoluta a /api/v1/...
  export function invalidar(): void;              // la llaman todas las mutaciones de lib/api después de 2xx
  export function suscribirInvalidacion(fn: () => void): () => void;
  // 401 → borra el token de sessionStorage y hace window.location.assign("/login"); error {code,message} → throw new ApiError(message, status)
  // fallo de red → ApiError("No pudimos conectarnos con UADEnet. Revisá tu conexión e intentá de nuevo.", 0)
  // useApi.ts
  export function useApi<T>(carga: () => Promise<T>, deps: unknown[]): { datos: T | undefined; error: string | null; cargando: boolean; recargar: () => void };
  // sesion.tsx — reemplaza a LibraryProvider con los mismos nombres de hooks
  export function SesionProvider({ children }): JSX.Element;
  export function useUsuario(): User | null; export function useUsuarioActual(): User; export function useRol(): Rol | null;
  ```
- Nuevas funciones en `lib/api` que reemplazan a los selectores que usan las pantallas: `getIndicadores(sede)`, `getActividad()`, `getCategorias()`, `getUnreadCount()` (desde `getNotifications("sin_leer")`), `getSaldo(): Promise<number>` (`GET /api/v1/wallets/me`).
- `getLoans`, `getPenalties` y `getNotifications` ya no reciben `userId`: el backend filtra por el token. `payPenalty(id)` no cambia de firma. `login(email, password)` guarda el token y el usuario en `sessionStorage` (`uadenet-sesion`).
- `adaptadores.ts` hace la conversión inversa de la tabla DTO de la Task 5. Timestamp → `FechaISO` con la fecha local. `student` → `estudiante`, `librarian` → `bibliotecario`.

- [ ] **Step 1:** Escribir `http.ts`, `adaptadores.ts`, `useApi.ts` y `sesion.tsx`, y reescribir los módulos de `lib/api`.
- [ ] **Step 2:** Correr `npm run typecheck -w @uadenet/frontend`. Esperado: errores **solo** en las pantallas que todavía importan de `lib/store`, que es la Task 10.
- [ ] **Step 3:** Commit `feat(frontend): cliente HTTP al CORE, sesión con JWT y adaptadores`.

---

### Task 10: Frontend — pantallas sobre la API y baja del store

**Files:**
- Modify: las 19 páginas de `frontend/src/app/(admin)` y `(student)` que importan `@/lib/store/*`, más `src/components/shell/Cabecera.tsx`, `PanelNotificaciones.tsx`, `Sidebar.tsx`, `src/app/layout.tsx` (Provider) y `src/app/login/page.tsx`
- Delete: `frontend/src/lib/store/` completo
- Modify: `frontend/src/app/(student)/sanciones/[id]/pago/page.tsx` (mostrar el saldo con `getSaldo()`)

**Interfaces:**
- Consumes: la Task 9.
- Regla por pantalla: cada selector sincrónico (`prestamosDe(db, id)`, `filtrarPrestamos`, `indicadores`, …) se reemplaza por `useApi(() => getX(filtro), [filtro])`. Mientras carga, se muestra un estado de carga discreto. Si hay error: `<Aviso tono="error">{error}</Aviso>`. Las mutaciones ya invalidan solas. Con el rol y la sesión, `useDb` deja de usarse.

- [ ] **Step 1:** Migrar las pantallas del estudiante y el shell (Cabecera, PanelNotificaciones, Sidebar, layout, login).
- [ ] **Step 2:** Migrar las pantallas del bibliotecario y borrar `lib/store`.
- [ ] **Step 3:** Correr `npm run typecheck -w @uadenet/frontend`, `npm run lint -w @uadenet/frontend` y `npm run build -w @uadenet/frontend`. Esperado: los tres limpios y `grep -r "lib/store" frontend/src` sin resultados.
- [ ] **Step 4:** Recorrer la app con `docker compose up -d` y `npm run dev`, en http://localhost:3000.
  - **Ana:** catálogo → solicitar → comprobante → mis préstamos → renovar → sanciones → pagar (ve el saldo; el comprobante sale y el saldo baja) → notificaciones (badge y marcar leídas).
  - **Laura:** panel → alta de libro → ejemplares → stock por sede → devolución por DNI `41222333` → sanciones.
  - **Estudiante sin saldo:** el pago muestra "No tenés saldo suficiente…".
  - **Biblioteca detenida:** las pantallas muestran "La biblioteca no está disponible…".
  - **Token alterado** en `sessionStorage`: la app vuelve al login.
- [ ] **Step 5:** Commit `feat(frontend): pantallas sobre la API real; se elimina el store local`.

---

### Task 11: Documentación de integración y cierre

**Files:**
- Create: `docs/integracion.md`
- Modify: `README.md` (raíz)

- [ ] **Step 1:** Escribir `docs/integracion.md` con una tabla con las columnas de la planilla (Módulo, Dirección, Canal, Identificador, Estructura, Ejemplo). Tiene que tener:
  - las 6 filas de la planilla;
  - las 2 filas nuevas: `GET /internal/v1/users` y `GET /api/v1/wallets/me`;
  - la topología de RabbitMQ (exchange, cola, DLX y DLQ);
  - el criterio de ids legibles contra UUID;
  - el mapeo `sede-<id>`;
  - qué componente es dueño de cada contrato.
- [ ] **Step 2:** Reescribir el README raíz:
  - qué hay en cada componente;
  - cómo levantar todo con `docker compose up -d`, copiar los `.env.example` a `.env` y `npm run dev`;
  - las cuentas demo y el estudiante sin saldo;
  - cómo publicar mensajes del Backoffice;
  - dónde se ven Swagger (`http://127.0.0.1:4001/docs`), los eventos (`GET :4000/internal/v1/events` con `X-Service-Key`) y la UI de RabbitMQ;
  - una sección "Base de datos (pendiente)": hay que implementar `Repositorio` en `library/src/datos/` y cambiar una línea de `server.ts`.
- [ ] **Step 3:** Correr `npm test` y `npm run typecheck` en la raíz. Esperado: todo PASS y limpio.
- [ ] **Step 4:** Commit `docs: contratos de integración y README de la app completa`.

---

### Task 12: Repositorio MariaDB (motor elegido por el usuario el 2026-10-21)

**Files:**
- Modify: `docker-compose.yml`: agregar el servicio `mariadb` con la imagen `mariadb:11.4`, el puerto `127.0.0.1:3306:3306` y el volumen nombrado `mariadb-datos`. La base `biblioteca` y el usuario `biblioteca` se crean con `MARIADB_DATABASE`, `MARIADB_USER`, `MARIADB_PASSWORD` y `MARIADB_ROOT_PASSWORD`, leídos de un `.env` en la raíz (no versionado). Versionar `.env.example` con valores de desarrollo.
- Create: `library/src/datos/esquema.sql`, `library/src/datos/mariadb.ts`, `library/src/datos/mariadb.test.ts`
- Modify: `library/package.json` (dependencia `mariadb`, el conector oficial; sin ORM), `library/.env.example` (`DATABASE_URL=mariadb://biblioteca:<pass>@127.0.0.1:3306/biblioteca`), `library/src/server.ts`, `README.md`, `docs/integracion.md` (sección "Base de datos")

**Interfaces:**
- Consumes: `Repositorio`, `contratoRepositorio`, `sembrar` y `FECHA_MAQUETA` (Task 2).
- Produces:
  ```ts
  export function crearRepositorioMariaDB(pool: mariadb.Pool, hoy: FechaISO): Promise<Repositorio>; // aplica esquema.sql (CREATE TABLE IF NOT EXISTS) y siembra si `libros` está vacía
  export function borrarEsquema(pool: mariadb.Pool): Promise<void>; // solo para tests
  ```
- Esquema (InnoDB, utf8mb4):
  - tablas `libros` (PK isbn), `ejemplares` (PK codigo, FK isbn), `prestamos` (PK id, FK isbn y copia), `sanciones` (PK id, FK loan_id **UNIQUE**: una sanción por préstamo), `notificaciones`, `actividad`, `tarifas`, `ubicaciones` (PK location_id) y `secuencias` (nombre, valor);
  - las fechas del dominio son `DATE`, salvo `actividad.fecha_hora`, que es `DATETIME`;
  - los montos son `DECIMAL(10,2)`;
  - `user_id` es `VARCHAR` sin FK, porque los usuarios son del CORE.
- `transaccion`: toma una conexión del pool, ejecuta `BEGIN`, bloquea con `SELECT valor FROM secuencias WHERE nombre = 'lock' FOR UPDATE` y ejecuta el trabajo con un `Repositorio` atado a esa conexión. Si sale bien hace `COMMIT`; si falla, `ROLLBACK` y relanza. Siempre libera la conexión. Llevar el comentario `// shortcut: un lock global serializa todas las escrituras; alcanza para una biblioteca, pasar a locks por fila si hay contención`.
- `siguienteId` incrementa `secuencias` dentro de la conexión actual.
- `server.ts`: `DATABASE_URL` es obligatoria. Si MariaDB no responde al arrancar, loguear "No se pudo conectar a MariaDB en <host>. ¿Levantaste `docker compose up -d`?" y salir con código 1. El repositorio en memoria queda solo para tests.

- [ ] **Step 1: Test que falla:** `mariadb.test.ts` llama a `contratoRepositorio("mariadb", async (hoy) => { await borrarEsquema(pool); return crearRepositorioMariaDB(pool, hoy); })` cuando existe `MARIADB_TEST_URL`. Si no existe, hace un `test.skip` con el motivo "MARIADB_TEST_URL no definida". Agregar también:
  ```ts
  test("FK única: una segunda sanción para el mismo préstamo falla y no queda nada escrito", ...)
  test("los datos sobreviven a crear un segundo repositorio sobre el mismo pool (persistencia real)", ...)
  ```
- [ ] **Step 2:** Correr `docker compose up -d mariadb` y después `MARIADB_TEST_URL=… npm test -w @uadenet/library`. Esperado: FAIL.
- [ ] **Step 3:** Implementar.
- [ ] **Step 4:** Correr los tests. Esperado: PASS con MariaDB, y la suite de memoria sigue en PASS. Después probar a mano con `npm run dev`: pedir un préstamo, reiniciar la Biblioteca y verificar que el préstamo sigue estando.
- [ ] **Step 5:** Commit `feat(library): repositorio MariaDB`.
