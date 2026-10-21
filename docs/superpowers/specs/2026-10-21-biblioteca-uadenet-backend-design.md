# Biblioteca UADEnet — Aplicación completa (frontend + backend)

Fecha: 2026-10-21 · Módulo 3 · Grupo 3 · Desarrollo de Aplicaciones II

## Intención

La Entrega 1 dejó el frontend del módulo Biblioteca funcionando contra un store
en memoria (`src/lib/store`, persistido en `localStorage`). Ahora la aplicación
tiene que ser completa: un backend real en Node que tenga las reglas de negocio,
y un frontend que hable con él por HTTP.

La Biblioteca no vive sola: es el Módulo 3 de UADEnet y se integra con el
**CORE** (identidad, gateway, billetera, eventos) y con el **Backoffice**
(tarifas y ubicaciones). Esos sistemas no existen para el grupo, así que se
**simulan en local**. El objetivo es que la solución muestre las formas de
**escalado y comunicación** de la materia (`RESUMEN.md`, Clases 2, 3, 5, 6, 7 y
10), no las ceremonias ágiles:

- **Escalado (Clases 2–3):** el sistema se divide en componentes independientes,
  cada uno con dueño posible distinto, que solo se relacionan por interfaces
  (contratos). Reduce dependencias entre equipos y deja claro el *code
  ownership*.
- **Comunicación / integración (Clases 5–7, 10):** acoplamiento débil vía un
  intermediario (API Gateway y cola de mensajes); integración síncrona (REST) y
  asíncrona (RabbitMQ); seguridad (JWT, autorización por rol, trazabilidad con
  `X-Correlation-Id`); buenas prácticas REST.

Los contratos entre módulos son los que el grupo ya documentó en
`UADEnet_Biblioteca_Grupo3.xlsx` (hoja "Flujo de Datos - Biblioteca").

## Decidido por el usuario

- TypeScript, Node y React.
- Base de datos SQL, **motor todavía sin elegir**. Se construye todo lo demás
  primero y la base se define después.
- CORE y Backoffice simulados en local.
- Aplicar las formas de escalado y comunicación del resumen de la materia.

## Objetivos

1. Las 22 pantallas existentes funcionan igual que hoy, pero con datos que
   vienen del backend a través del CORE Gateway.
2. Las reglas de negocio viven en el backend de la Biblioteca (no en el
   navegador).
3. Cada integración de la planilla está implementada y se puede observar:
   login, gateway con headers de identidad, débito en billetera, evento
   `library.penalty.applied.v1`, y los dos mensajes del Backoffice por cola.
4. La capa de datos está detrás de una interfaz, de modo que elegir el motor
   SQL después signifique escribir una implementación nueva sin tocar el resto.

## No objetivos

- Elegir o instalar el motor SQL (queda para después; ver "Base de datos").
- Un CORE o Backoffice "de verdad": solo lo mínimo para cumplir los contratos.
- Despliegue a la nube, HTTPS, CI/CD.
- SOAP (no hay ningún contrato SOAP en la planilla).
- Rediseñar pantallas: el aspecto visual queda como está.

## Anti-objetivos (sería un fracaso aunque funcione)

- Que la Biblioteca lea o escriba datos de otro módulo directamente (por
  ejemplo, compartir base con el CORE). Integración por datos = acoplamiento
  fuerte: lo que la materia enseña a evitar.
- Que el frontend llame a la Biblioteca salteando el Gateway.
- Código compartido (imports) entre componentes. Se comparten **contratos**,
  no código.
- Perder datos de un mensaje de la cola por confirmarlo antes de procesarlo.

## Arquitectura

```
                         ┌──────────────── CORE (simulado) :4000 ────────────────┐
 Navegador               │  POST /api/v1/auth/login  → JWT                        │
 frontend :3000 ──HTTP──▶│  /api/v1/library/*  Gateway: valida JWT, agrega        │
 (Next.js)               │     X-User-Id, X-User-Roles, X-User-Permissions,       │
                         │     X-Correlation-Id y reenvía ─────────┐              │
                         │  /internal/v1/wallets/{userId}/debits   │              │
                         │  /internal/v1/events                    │              │
                         │  /internal/v1/users                     │              │
                         └──────────────▲──────────────────────────┼──────────────┘
                                        │ REST (CoreAdapter)       ▼
                         ┌──────────── Biblioteca (library) :4001 ───────────────┐
                         │  rutas → servicios (reglas) → repositorios (interfaz) │
                         │  consumidor RabbitMQ                                  │
                         └──────────────▲────────────────────────────────────────┘
                                        │ AMQP
                         ┌──── RabbitMQ (Docker) :5672 / :15672 ────┐
                         │  exchange topic "backoffice.events"       │
                         │  cola library.backoffice  + DLX → DLQ     │
                         └──────────────▲────────────────────────────┘
                                        │ publica
                              Backoffice (simulado, CLI)
```

### Estructura del repositorio

Monorepo con **npm workspaces**. Cada carpeta es un componente con su propio
`package.json`, `tsconfig.json` y README corto (qué expone, qué consume, cómo
correrlo):

```
frontend/      el Next.js actual, movido desde la raíz
core/          CORE simulado (Express + TS)
library/       módulo Biblioteca (Express + TS) — el producto real
backoffice/    Backoffice simulado: CLI que publica mensajes en RabbitMQ
docs/          specs + docs/integracion.md (mapa de contratos)
docker-compose.yml   RabbitMQ con management UI
package.json   workspaces + script "dev" que levanta todo
```

Un `npm run dev` en la raíz levanta frontend, core y library en paralelo (por
ejemplo con `concurrently`). RabbitMQ se levanta con `docker compose up -d`.
El usuario tiene Docker 28 instalado (el daemon no estaba corriendo al
diseñar) y Node 22.

### Puertos y configuración

Cada servicio lee su configuración de variables de entorno con un
`.env.example` versionado: puertos, URL del CORE, URL de RabbitMQ, secreto JWT,
URL interna de la Biblioteca. Valores por defecto: frontend 3000, core 4000,
library 4001, RabbitMQ 5672 (UI 15672).

## Componentes

### 1. `library/` — Biblioteca (el módulo real)

Express + TypeScript, en tres capas (Clase 4: presentación → negocio → datos):

- **Rutas / controladores:** validan la entrada (frontera de confianza),
  leen la identidad de los headers del Gateway, traducen a llamadas de servicio
  y a respuestas HTTP. Validación con `zod` *(decisión de diseño)*.
- **Servicios (negocio):** todas las reglas que hoy están en
  `src/lib/domain/rules.ts` y en los cuerpos de `src/lib/api/*`: préstamo de 14
  días, sanción al día 8 de atraso, renovación +3 días hasta 2 veces, bloqueo de
  préstamos con sanción pendiente, ISBN 10–13 dígitos, generación de
  notificaciones y del feed de actividad del bibliotecario.
- **Repositorios (datos):** interfaces TypeScript por agregado (libros,
  ejemplares, préstamos, sanciones, notificaciones, actividad, configuración).
  Implementación inicial **en memoria**, sembrada con los datos de
  `src/lib/store/seed.ts`. Los datos se pierden al reiniciar el proceso hasta
  que exista la implementación SQL; es aceptable.
- **Adapters de integración** (patrón Adapter, Clase 3): `CoreAdapter` encapsula
  las llamadas REST al CORE (débito, eventos, usuarios). El negocio no sabe de
  URLs ni de formatos del CORE.
- **Consumidor RabbitMQ** (ver Backoffice).

**Identidad y autorización.** La Biblioteca no maneja contraseñas ni JWT: confía
en los headers `X-User-Id` / `X-User-Roles` / `X-User-Permissions` que pone el
Gateway (así lo dice la planilla). Autorización **RBAC** por rol: `estudiante`
solo ve y opera sobre lo suyo (sus préstamos, sanciones, notificaciones);
`bibliotecario` accede al panel admin. Para que nadie pueda saltearse el
Gateway, la Biblioteca escucha solo en `127.0.0.1` y exige un header de secreto
compartido con el CORE (`X-Gateway-Key`) *(decisión de diseño)*.

**Trazabilidad.** Todo request trae `X-Correlation-Id`; la Biblioteca lo loguea
y lo propaga en cada llamada al CORE y lo incluye en los eventos.

**Fecha "hoy".** Hoy es la constante `HOY = "2026-08-26"` para coincidir con las
capturas. En el backend pasa a ser la fecha real, y el seed se reescribe
**relativo a la fecha de arranque** para que los escenarios de la demo sigan
existiendo (un préstamo a 2 días de vencer, uno con 3 días de atraso, uno con
18 y sanción, etc.) *(decisión de diseño)*.

**Monto de la multa.** Deja de ser la constante `MONTO_MULTA`: se guarda en la
repositorio como **historial de tarifas** (monto + `effectiveFrom`), arranca
con 2500 ARS vigente y el mensaje `backoffice.rate.changed.v1` agrega una
entrada. Al crear una sanción se usa la tarifa con el `effectiveFrom` más
reciente que no sea futuro, así un mensaje con fecha futura queda guardado y
entra en vigencia solo *(decisión de diseño)*. Las sanciones ya generadas
conservan su monto. Reglas del consumidor:
- mensaje bien formado con `rateType` distinto de `LIBRARY_LATE_FEE` → no es
  para la Biblioteca: ack y se ignora (con log);
- JSON inválido, campos faltantes, monto no numérico o moneda distinta de ARS →
  `nack` sin reencolar → DLQ.

**Pago de multa** (`POST /api/v1/library/penalties/{id}/payments`): el
estudiante dueño de la sanción la paga; la Biblioteca llama a
`POST /internal/v1/wallets/{userId}/debits` con el cuerpo de la planilla. Si el
CORE responde saldo insuficiente, la sanción sigue pendiente y el error llega a
la pantalla. Si el débito es exitoso, se marca cobrada y se devuelve el
comprobante. Si el CORE no responde, error 502/503 y la sanción no cambia.

**Detección de atrasos** *(decisión de diseño)*. La maqueta ya muestra
préstamos sancionados sin devolver (PRE-1001, 18 días de atraso), así que la
sanción no espera a la devolución. Un **job periódico** dentro de `library/`
(al arrancar y luego cada hora; con `setInterval` alcanza) recorre los
préstamos abiertos y crea la sanción de los que llegaron a 8 días de atraso.
La devolución hace el mismo chequeo por si el job no corrió. Es idempotente:
una sanción por préstamo como máximo, y el evento se publica una sola vez, al
crearla. Los GET no modifican datos. La sanción **congela** `diasAtraso` y el
monto vigente al momento de la detección (el modelo ya tiene `fechaDeteccion`);
desde ese momento el estudiante queda bloqueado para pedir nuevos préstamos
hasta pagar.

**Generación de sanción.** Cuando una devolución o el job de detección
cruzan el umbral de 8 días, se crea la sanción y se publica
`library.penalty.applied.v1` vía `POST /internal/v1/events` con el formato
exacto de la planilla. Si la publicación falla, la sanción igual queda
registrada y el fallo se loguea con el correlation id (no se pierde la sanción
por un problema de integración).

**Documentación.** OpenAPI 3 escrito a mano (`library/openapi.yaml`) servido con
Swagger UI en `/docs` (Clase 10).

#### API REST de la Biblioteca

Prefijo `/api/v1/library` (lo que el Gateway reenvía). Sigue las buenas
prácticas de la Clase 10: recursos en inglés, plural, minúscula; sin verbos
salvo controladores; JSON con keys en inglés **lowerCamelCase**; **fechas como
Unix timestamp**; POST/PUT/PATCH devuelven el recurso; filtros por query
string; status HTTP + código de error interno.

Formato de error: `{ "code": "LOAN_LIMIT_PENALTY", "message": "<texto para
mostrar en pantalla, castellano rioplatense>" }`.

Recursos (los endpoints concretos los define el builder respetando las
reglas; esta es la cobertura mínima, derivada de `src/lib/api/*`):

| Recurso | Operaciones |
|---|---|
| `books` | listar con filtros (texto, categoría, sede, disponibilidad), detalle con stock por sede, alta, edición, activar/desactivar |
| `books/{isbn}/copies` | listar ejemplares, alta de N ejemplares por sede, cambiar estado de un ejemplar |
| `loans` | listar (estudiante: los suyos; admin: todos con filtros), detalle, solicitar, `…/{id}/renew`, `…/{id}/return` |
| `penalties` | listar con filtros, detalle, `…/{id}/payments` |
| `notifications` | listar con filtro, marcar una / todas como leídas |
| `dashboard` (o equivalente) | indicadores del inicio del estudiante y del panel del bibliotecario, feed de actividad |
| `sites` | sedes (Monserrat, Belgrano, Pinamar) |

`renew` y `return` son controladores (acciones), permitidos por la regla.

### 2. `core/` — CORE simulado

Express + TypeScript. Lo mínimo para cumplir los contratos:

- **Usuarios** en memoria: los de `seed.ts` (Ana García estudiante, Laura
  Fernández bibliotecaria, y el resto de estudiantes del seed), cada uno con
  contraseña `uade1234` hasheada, rol, legajo, DNI, sede por defecto y
  **saldo institucional** inicial (ej. Ana con saldo suficiente para pagar una
  multa; algún estudiante sin saldo para probar el rechazo).
- `POST /api/v1/auth/login` → valida `@uade.edu.ar` y contraseña, devuelve
  `{ token, user }`. JWT firmado (HS256) con `sub`, `roles`, `permissions`,
  expiración de algunas horas. Esta es la parte **OAuth 2.0 + JWT** de la
  materia en su forma mínima.
- **Gateway** `ALL /api/v1/library/*` (patrón Proxy/Facade, Clase 3): valida el
  `Authorization: Bearer`, genera o reusa `X-Correlation-Id`, reemplaza el
  token por los headers `X-User-*` y `X-Gateway-Key`, y reenvía a la
  Biblioteca. 401 si el token falta o es inválido. CORS habilitado para el
  frontend.
- `POST /internal/v1/wallets/{userId}/debits` → descuenta del saldo; 409 (o
  422) con código `INSUFFICIENT_FUNDS` si no alcanza. Idempotente por
  `externalReference`: el mismo `penalty/{id}` no se debita dos veces.
- `GET /api/v1/wallets/me` (vía token) para que la pantalla de pago muestre el
  saldo disponible *(decisión de diseño; no está en la planilla)*.
- `POST /internal/v1/events` → guarda el evento y lo loguea; `GET` para verlo.
- `GET /internal/v1/users?ids=…` y `?q=…` (DNI, legajo, nombre) para que la
  Biblioteca muestre datos del estudiante y el mostrador de devolución pueda
  buscar por DNI/legajo. **No está en la planilla**: se agrega como contrato
  nuevo y se documenta en `docs/integracion.md` *(decisión de diseño)*.
- Las rutas `/internal/*` exigen la misma clave de servicio, no son públicas.

### 3. `backoffice/` — Backoffice simulado

CLI en TypeScript (`npm run publish:rate -- 3000`,
`npm run publish:location -- …`) que publica en RabbitMQ los dos mensajes de la
planilla con su estructura exacta. Topología (Clase 7), declarada por la
Biblioteca al arrancar (es la consumidora):

- Exchange **topic** `backoffice.events`; routing keys
  `backoffice.rate.changed.v1` y `backoffice.location.upserted.v1`.
- Cola durable `library.backoffice` enlazada con `backoffice.#`.
- **Ack explícito**: la Biblioteca confirma recién después de aplicar el cambio.
- **DLX** `library.dlx` → cola `library.dlq` para mensajes que fallan la
  validación o el procesamiento (`nack` sin reencolar).
- Mensajes persistentes.

`backoffice.location.upserted.v1`: la Biblioteca guarda la ubicación (sala o
piso dentro de una sede, por `siteId`) en su repositorio y la expone en la API.
No cambia ninguna pantalla actual.

Si RabbitMQ no está levantado, la Biblioteca arranca igual, loguea el error y
reintenta la conexión periódicamente: el resto de la app funciona sin el
Backoffice (el acoplamiento débil es el punto).

### 4. `frontend/` — Next.js actual

- Se mueve a `frontend/` sin cambios visuales.
- Desaparecen `src/lib/store` (store, seed, `localStorage`) y la lógica de
  negocio de `src/lib/api/*`.
- `src/lib/api/*` pasa a hacer `fetch` al CORE (`NEXT_PUBLIC_CORE_URL`),
  mandando el token y traduciendo el JSON en inglés con timestamps al modelo
  actual de `src/lib/domain/types.ts` (un **Adapter** en el cliente). Así las
  pantallas no cambian sus nombres de campos.
- Las pantallas hoy leen sincrónicamente con `useDb()` + selectores (22
  archivos). Pasan a pedir los datos a `lib/api` con estados de carga y error,
  y a refrescar después de cada mutación. El mecanismo (hook propio, SWR, etc.)
  queda al builder; no agregar una librería si un hook chico alcanza.
- Sesión: el token se guarda en `sessionStorage`; logout lo borra; un 401
  manda al login.
- `src/lib/domain/rules.ts` queda solo con lo de presentación (formatos de
  fecha y monto, etiquetas). La fuente de verdad de las reglas es el backend.
- Las "cuentas demo" del login siguen, con las credenciales del CORE simulado.

### Contratos

Los componentes no importan código entre sí. Los contratos son:

- `library/openapi.yaml` (API de la Biblioteca),
- los contratos del CORE y del Backoffice de la planilla, más los dos
  agregados (`/internal/v1/users`, `/api/v1/wallets/me`),

**Identificadores** *(decisión de diseño)*. Se mantienen los ids legibles que
ya usan las pantallas y las URLs (`PRE-1003`, `SAN-00031`, `RET-…`, ids de
usuario del seed, sedes `monserrat`/`belgrano`/`pinamar`). Los UUID de los
ejemplos de la planilla se toman como ilustrativos: el campo se llena con el id
real del sistema. En `location.upserted.v1`, el `siteId` del Backoffice se
mapea a la sede quitando el prefijo `sede-` (`sede-monserrat` → `monserrat`);
un `siteId` desconocido va a la DLQ. `docs/integracion.md` aclara este criterio.

todos listados en `docs/integracion.md`, una tabla con este formato: módulo,
dirección, canal (REST síncrono / cola asíncrona), identificador y ejemplo.
Así cada componente puede tener un dueño distinto y trabajar en paralelo
(Clases 2–3).

## Base de datos (pendiente)

El motor SQL se elige después. Mientras tanto:

- Las interfaces de repositorio se diseñan pensando en SQL: entidades con clave
  primaria, relaciones por id (préstamo → ejemplar → libro; sanción →
  préstamo), operaciones que en SQL serían transacciones (solicitar préstamo =
  marcar ejemplar + crear préstamo; devolución = cerrar préstamo + liberar
  ejemplar + crear sanción) expuestas como **una** operación de repositorio o
  con un mecanismo de unidad de trabajo, para no tener que rediseñar al pasar a
  SQL.
- Concurrencia: dos estudiantes pidiendo el último ejemplar a la vez no pueden
  quedarse con el mismo. En memoria lo garantiza el event loop si la operación
  es sincrónica; la interfaz debe permitir que la versión SQL lo resuelva con
  una transacción.
- Fuera de alcance por ahora: migraciones, ORM, driver.

## Verificación

- Tests de las reglas de negocio de `library/` (servicios contra el repositorio
  en memoria) con el test runner de Node o vitest: préstamo, renovación,
  devolución con y sin sanción, bloqueo por sanción, pago con y sin saldo,
  aplicación del `rate.changed`.
- `tsc --noEmit` limpio en los cuatro componentes; `next build` del frontend.
- Recorrida manual de los flujos de las 22 pantallas con los tres servicios
  levantados, más: publicar un `rate.changed` y ver que la próxima sanción usa
  el nuevo monto; publicar un mensaje inválido y verlo en la DLQ desde la UI de
  RabbitMQ; ver el evento `library.penalty.applied.v1` en el CORE; seguir un
  `X-Correlation-Id` en los logs del CORE y de la Biblioteca.
- README raíz con cómo levantar todo.

## Decisiones tomadas en el diseño (revisar)

- Express (visto en la Clase 4) para CORE y Biblioteca.
- Monorepo con npm workspaces; frontend movido a `frontend/`.
- `zod` para validar entradas.
- API de la Biblioteca en inglés con timestamps (Clase 10); el frontend adapta
  al modelo en castellano que ya usa.
- Biblioteca protegida con `X-Gateway-Key` y escuchando solo en localhost.
- Fecha real en lugar de `HOY` fijo; seed relativo a la fecha de arranque.
- Monto de multa configurable vía Backoffice, con historial para tarifas de
  fecha futura.
- Job periódico que sanciona préstamos sin devolver al llegar a 8 días; la
  sanción congela días y monto.
- Ids legibles en lugar de los UUID de los ejemplos de la planilla.
- Dos contratos nuevos no presentes en la planilla: `/internal/v1/users` y
  `/api/v1/wallets/me`.

## Queda a criterio del builder

Nombres exactos de endpoints dentro de las reglas REST; estructura interna de
carpetas de cada servicio; mecanismo de fetch en el frontend; formato de logs;
cómo correr los servicios en desarrollo (`tsx`, `ts-node`, etc.); textos de
los errores, siempre que coincidan con los que hoy muestran las pantallas.
