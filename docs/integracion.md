# Contratos de integración — Biblioteca (Módulo 3)

Los componentes no comparten código: solo estos contratos. Fuente: planilla
`UADEnet_Biblioteca_Grupo3.xlsx` (hoja "Flujo de Datos - Biblioteca"), más dos
filas nuevas marcadas con (*) que no están en la planilla.

Todas las rutas `/internal/*` exigen `X-Service-Key`. Los importes viajan como
string con dos decimales y la moneda es siempre `ARS`.

## Tabla de contratos

| Módulo | Dirección | Canal | Identificador | Estructura | Ejemplo |
|---|---|---|---|---|---|
| CORE | CORE → Biblioteca | REST síncrono (Gateway) | `ALL /api/v1/library/*` | El Gateway valida el JWT y reenvía con `X-User-Id`, `X-User-Roles`, `X-User-Permissions`, `X-Gateway-Key`, `X-Correlation-Id` | `X-User-Id: u-ana`, `X-User-Roles: estudiante` |
| CORE | Frontend → CORE | REST síncrono | `POST /api/v1/auth/login` | Req `{email, password}`; res `{token, user}` (JWT HS256) | `{"email":"ana.garcia@uade.edu.ar","password":"uade1234"}` |
| CORE | Biblioteca → CORE | REST síncrono | `POST /internal/v1/wallets/{userId}/debits` | Req `{amount, currency, concept, sourceModule, externalReference}`; res `{operationId, balance}`. 409 `INSUFFICIENT_FUNDS` si no alcanza. Idempotente por `externalReference` | `{"amount":"2500.00","currency":"ARS","concept":"LIBRARY_FINE","sourceModule":"library","externalReference":"penalty/SAN-00031"}` |
| CORE | Biblioteca → CORE | REST síncrono | `POST /internal/v1/events` | `{eventType, source, subject, data}`; res 202. `GET` del mismo path lista los eventos | `{"eventType":"library.penalty.applied.v1","source":"library","subject":"user/u-camila","data":{"userId":"u-camila","loanId":"PRE-1001","daysLate":18,"amount":"2500.00","currency":"ARS"}}` |
| Backoffice | Backoffice → Biblioteca | Cola asíncrona (AMQP) | `backoffice.rate.changed.v1` | `{rateType, amount, currency, effectiveFrom}` | `{"rateType":"LIBRARY_LATE_FEE","amount":"3000","currency":"ARS","effectiveFrom":"2026-11-01"}` |
| Backoffice | Backoffice → Biblioteca | Cola asíncrona (AMQP) | `backoffice.location.upserted.v1` | `{locationId, siteId, name, capacity, status}` | `{"locationId":"loc-1a2b3c4d","siteId":"sede-monserrat","name":"Biblioteca - PB","capacity":120,"status":"ACTIVE"}` |
| CORE (*) | Biblioteca → CORE | REST síncrono | `GET /internal/v1/users?ids=a,b` o `?q=` | Res: lista de `{id, name, email, studentId, nationalId, role, defaultSiteId, initials, label}`. `q` busca por nombre, mail, legajo o DNI | `GET /internal/v1/users?q=40123456` |
| CORE (*) | Frontend → CORE | REST síncrono | `GET /api/v1/wallets/me` (Bearer) | Res `{balance, currency}` | `{"balance":"5000.00","currency":"ARS"}` |

Reglas del consumidor de `rate.changed.v1`: un `rateType` distinto de
`LIBRARY_LATE_FEE` se confirma e ignora; JSON inválido, campos faltantes, monto
no numérico o moneda distinta de ARS van a la DLQ. Una tarifa con
`effectiveFrom` futuro se guarda y entra en vigencia sola.

## Dueño de cada contrato

| Contrato | Dueño (define y versiona) | Consumidor |
|---|---|---|
| Gateway `/api/v1/library/*`, login, `wallets/me`, `wallets/{id}/debits`, `events`, `users` | `core/` (CORE) | Frontend, Biblioteca |
| `library/openapi.yaml` (API pública de la Biblioteca) | `library/` | Frontend vía Gateway |
| `backoffice.rate.changed.v1`, `backoffice.location.upserted.v1` | `backoffice/` (publica) | `library/` (consume) |
| `library.penalty.applied.v1` | `library/` (publica) | CORE |

## Topología de RabbitMQ

La declara la Biblioteca al arrancar (es la consumidora); el Backoffice solo
declara el exchange y publica. Mensajes persistentes, ack explícito después de
aplicar el cambio.

| Elemento | Nombre | Detalle |
|---|---|---|
| Exchange | `backoffice.events` | topic, durable. Routing keys `backoffice.rate.changed.v1` y `backoffice.location.upserted.v1` |
| Cola | `library.backoffice` | durable, binding `backoffice.#`, `x-dead-letter-exchange: library.dlx`, prefetch 10 |
| DLX | `library.dlx` | fanout, durable |
| DLQ | `library.dlq` | durable, enlazada al DLX. Recibe los `nack` sin reencolar (mensajes inválidos) |

Si RabbitMQ no está levantado, la Biblioteca arranca igual y reintenta la
conexión cada 5 s. Para ver la DLQ: `http://localhost:15672` (guest/guest).

## Ids: legibles, no UUID

Los UUID de los ejemplos de la planilla son ilustrativos. Se mantienen los ids
legibles que ya usan las pantallas y las URLs: `PRE-1003` (préstamo),
`SAN-00031` (sanción), `RET-…` (devolución), `u-ana` (usuario), y sedes
`monserrat` / `belgrano` / `pinamar`. El campo de cada contrato se completa con
el id real del sistema.

## Mapeo `sede-<id>`

En `location.upserted.v1` el `siteId` del Backoffice es `sede-<id>`; la
Biblioteca quita el prefijo `sede-`: `sede-monserrat` → `monserrat`. Un `siteId`
que no mapea a `monserrat`, `belgrano` o `pinamar` va a la DLQ.

## Base de datos

MariaDB es **privada de la Biblioteca**: ningún otro módulo la lee ni la
escribe. El CORE y el Backoffice se enteran de lo que pasa solo por los
contratos de arriba. Es el principio de "no integración por datos": compartir
base es acoplamiento fuerte.

## Seguir un `X-Correlation-Id`

El Gateway reusa el `X-Correlation-Id` del cliente o genera uno, lo reenvía a la
Biblioteca, y la Biblioteca lo propaga en cada llamada al CORE. Se ve en la
terminal de `npm run dev` (cada línea empieza con `[core]` o `[library]` y luego viene el id):

```
[core] 7c1e…  → library POST /api/v1/library/penalties/SAN-00031/payments 201
[library] 7c1e… POST /api/v1/library/penalties/SAN-00031/payments 201 42ms
```

Para seguir un caso, mandar el header propio (`curl -H "X-Correlation-Id: demo-1" …`)
y buscar `demo-1` en las dos salidas. El CORE también lo devuelve en la respuesta.
