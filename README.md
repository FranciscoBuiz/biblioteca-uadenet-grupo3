# UADEnet · Biblioteca Universitaria

Módulo 3 (Biblioteca) de UADEnet: frontend, backend, y simulaciones locales del
CORE y del Backoffice con los que se integra. Cubre los perfiles **estudiante**
(catálogo, préstamos, sanciones, notificaciones) y **bibliotecario** (catálogo,
stock por sede, préstamos, devoluciones, sanciones).

Facultad de Ingeniería y Ciencias Exactas · Desarrollo de Aplicaciones II · Grupo 3
Barbieri · Brandt · Buiz · Marinoni · Sanguineti

## Componentes

Monorepo con npm workspaces. Cada carpeta tiene su README.

| Carpeta | Qué es | Puerto |
|---|---|---|
| `frontend/` | Next.js 15 + React 19. Las 22 pantallas; habla solo con el CORE por HTTP | 3000 |
| `core/` | CORE simulado: login con JWT, Gateway hacia la Biblioteca, billetera, eventos, usuarios | 4000 |
| `library/` | Biblioteca, el producto real: rutas, servicios con las reglas de negocio, repositorio MariaDB, consumidor RabbitMQ | 4001 (solo 127.0.0.1) |
| `backoffice/` | Backoffice simulado: CLI que publica mensajes en RabbitMQ | — |
| `docs/` | `integracion.md` (contratos entre módulos) y specs | — |

La intro "Frontend del módulo…" de la Entrega 1 ya no aplica: el frontend dejó de
tener store local y `localStorage`; los datos y las reglas viven en `library/`.

## Cómo levantarlo

```bash
npm install                                  # en la raíz (workspaces)
cp .env.example .env                         # credenciales de MariaDB para docker compose
cp core/.env.example core/.env
cp library/.env.example library/.env         # completar <pass> en DATABASE_URL con MARIADB_PASSWORD
cp frontend/.env.example frontend/.env
docker compose up -d                         # RabbitMQ (5672, panel 15672) y MariaDB (3306)
npm run dev                                  # frontend, core y library en paralelo
```

Abrir `http://localhost:3000`. Otros comandos: `npm test`, `npm run typecheck`,
`npm run build -w @uadenet/frontend`, `npm run lint -w @uadenet/frontend`.

## Cuentas de la demo

| Perfil | Mail | Contraseña |
|---|---|---|
| Estudiante | `ana.garcia@uade.edu.ar` | `uade1234` |
| Bibliotecaria | `laura.fernandez@uade.edu.ar` | `uade1234` |

Ana tiene saldo ($5000). El estudiante **sin saldo** es `u-camila` (ver
`core/README.md`): sirve para probar el rechazo `INSUFFICIENT_FUNDS` al pagar una
multa. El login tiene atajos para las dos cuentas principales.

## Publicar mensajes del Backoffice

Con RabbitMQ levantado y la Biblioteca corriendo:

```bash
npm run publish:rate -w @uadenet/backoffice -- 3000 2026-11-01
npm run publish:location -w @uadenet/backoffice -- sede-monserrat "Biblioteca - PB" 120
npm run publish:invalid -w @uadenet/backoffice      # termina en la DLQ
```

Detalle en `backoffice/README.md`.

## Dónde mirar

- **Swagger de la Biblioteca:** `http://127.0.0.1:4001/docs`.
- **Eventos recibidos por el CORE** (p. ej. `library.penalty.applied.v1`):
  `GET http://localhost:4000/internal/v1/events` con header `X-Service-Key`
  (valor de `SERVICE_KEY` en `core/.env`).
- **RabbitMQ:** `http://localhost:15672` (guest/guest): cola `library.backoffice` y DLQ `library.dlq`.
- **Contratos y trazabilidad:** `docs/integracion.md`.

## Base de datos (MariaDB)

La Biblioteca usa MariaDB 11.4 (servicio `mariadb` de `docker-compose.yml`,
conector oficial, sin ORM), implementada como un `Repositorio` más.

- **Esquema:** se crea al arrancar la Biblioteca (`CREATE TABLE IF NOT EXISTS`).
- **Seed:** se carga solo si la base está vacía, relativo a la fecha de arranque.
- **Base de tests:** `biblioteca_test`, aparte porque los tests borran las tablas.
  Los tests de MariaDB se saltean si falta `MARIADB_TEST_URL`.
- **Resetear los datos de desarrollo:** borrar las tablas de `biblioteca`, o el
  volumen (`docker compose down -v`), y reiniciar la Biblioteca para que recree
  el esquema y el seed.

```bash
MARIADB_TEST_URL=mariadb://biblioteca:<pass>@127.0.0.1:3306/biblioteca_test npm test -w @uadenet/library
```

`docker/mariadb-init.sql` crea `biblioteca_test`, pero solo cuando el volumen
`mariadb-datos` es nuevo. Si el volumen ya existía, creala una vez a mano:

```bash
docker compose exec mariadb mariadb -uroot -p<MARIADB_ROOT_PASSWORD> -e "CREATE DATABASE IF NOT EXISTS biblioteca_test; GRANT ALL ON biblioteca_test.* TO 'biblioteca'@'%';"
```

La base es privada de la Biblioteca: ningún otro módulo la lee.

## Escalado y comunicación (ideas de la materia)

- **Componentes con dueño:** cada carpeta es un componente que un equipo podría
  poseer y desplegar por separado (code ownership).
- **Contratos, no código compartido:** los componentes no se importan entre sí;
  se relacionan por `library/openapi.yaml` y `docs/integracion.md`.
- **Acoplamiento débil:** el frontend solo habla con el CORE; el Gateway valida el
  JWT y reenvía a la Biblioteca (que exige `X-Gateway-Key`). El Backoffice solo
  conoce la cola, no a la Biblioteca.
- **Síncrono vs asíncrono:** REST para lo que necesita respuesta ya (login,
  débito de la multa, consulta de usuarios); AMQP para lo que puede esperar
  (tarifas y ubicaciones del Backoffice), con ack explícito y DLQ para no perder
  mensajes. Si RabbitMQ cae, la app sigue funcionando.
- **Trazabilidad:** `X-Correlation-Id` viaja del Gateway a la Biblioteca y de ahí
  al CORE, y aparece en los logs de ambos.

## Reglas de negocio

Viven en `library/` (el frontend solo formatea).

| Regla | Valor |
|---|---|
| Plazo de préstamo | 14 días corridos |
| Próximo a vencer | faltan 3 días o menos |
| Umbral de sanción | día 8 de atraso (un job la detecta al arrancar y cada hora) |
| Monto de la multa | $2.500 ARS por defecto; cambia con `backoffice.rate.changed.v1` |
| Renovación | +3 días, máximo 2, bloqueada si hay reservas |
| Validación de ISBN | 10 a 13 dígitos |
| Bloqueo por deuda | con una multa impaga no se pueden pedir préstamos |
| Sedes | Monserrat (CABA), Belgrano, Pinamar |

## Identidad visual

Azul institucional `#1A2B4B`, azul secundario `#2D5DA1`, verde `#127453`, rojo
`#D32F2F`, neutro `#F8F9FA`. Tipografías Libre Caslon Text (títulos) y Hanken
Grotesk (texto). Diseñado a 1280px; debajo de 1024px el menú pasa a drawer y
debajo de 768px las tablas se apilan como tarjetas.
