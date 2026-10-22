# UADEnet · Biblioteca Universitaria

Módulo 3 (Biblioteca) de UADEnet: frontend, backend, y simulaciones locales del
CORE y del Backoffice con los que se integra. Cubre los perfiles **estudiante**
(catálogo, préstamos, sanciones, notificaciones) y **bibliotecario** (catálogo,
stock por sede, préstamos, devoluciones, sanciones).

Facultad de Ingeniería y Ciencias Exactas · Desarrollo de Aplicaciones II · Grupo 3
Barbieri · Brandt · Buiz · Marinoni · Sanguineti

## Componentes

Monorepo con npm workspaces. `core/`, `library/` y `backoffice/` tienen su README.

| Carpeta | Qué es | Puerto |
|---|---|---|
| `frontend/` | Next.js 15 + React 19. Pantallas de estudiante y bibliotecario; habla solo con el CORE por HTTP | 3000 |
| `core/` | CORE simulado: login con JWT, Gateway hacia la Biblioteca, billetera, eventos, usuarios | 4000 (solo 127.0.0.1) |
| `library/` | Biblioteca, el producto real: rutas, servicios con las reglas de negocio, repositorio MariaDB, consumidor RabbitMQ | 4001 (solo 127.0.0.1) |
| `backoffice/` | Backoffice simulado: CLI que publica mensajes en RabbitMQ | — |
| `docs/` | `integracion.md` (contratos entre módulos) y specs | — |

## Qué necesitás

| Herramienta | Versión | Para qué |
|---|---|---|
| [Node.js](https://nodejs.org) | **22 o superior** (trae npm 10) | frontend, CORE, Biblioteca y Backoffice |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | cualquiera reciente, con Docker Compose | RabbitMQ y MariaDB |
| Git | cualquiera | clonar el repo |

Además, estos puertos tienen que estar libres: **3000** (frontend), **4000**
(CORE), **4001** (Biblioteca), **5672** y **15672** (RabbitMQ) y **3306**
(MariaDB).

Para comprobar las versiones:

```bash
node --version      # v22.x o mayor
docker --version
docker compose version
```

## Instalación desde cero (una sola vez)

1. **Clonar el repo y entrar a la carpeta.**

   ```bash
   git clone <url-del-repo> biblioteca-uadenet
   cd biblioteca-uadenet
   ```

2. **Instalar las dependencias.** Se hace una sola vez, en la raíz; npm instala
   las de los cuatro componentes (workspaces).

   ```bash
   npm install
   ```

3. **Crear los archivos de configuración** copiando los de ejemplo. Los valores de
   ejemplo ya funcionan para desarrollo local; no hace falta editarlos.

   En Git Bash, macOS o Linux:

   ```bash
   cp .env.example .env
   cp core/.env.example core/.env
   cp library/.env.example library/.env
   cp frontend/.env.example frontend/.env
   ```

   En PowerShell:

   ```powershell
   Copy-Item .env.example .env
   Copy-Item core/.env.example core/.env
   Copy-Item library/.env.example library/.env
   Copy-Item frontend/.env.example frontend/.env
   ```

4. **Abrir Docker Desktop** y esperar a que diga que está corriendo (en Windows,
   el ícono de la ballena deja de animarse).

5. **Levantar RabbitMQ y MariaDB.** La primera vez descarga las imágenes y tarda
   unos minutos.

   ```bash
   docker compose up -d
   docker compose ps          # los dos servicios tienen que figurar "running"
   ```

La primera vez que arranca la Biblioteca crea sola las tablas en MariaDB y carga
los datos de la demo; no hay que correr ningún script de base de datos.

## Cómo ejecutarlo (cada vez)

1. Abrir Docker Desktop.
2. En la raíz del proyecto:

   ```bash
   docker compose up -d       # RabbitMQ y MariaDB (si ya estaban, no hace nada)
   npm run dev                # frontend, CORE y Biblioteca en paralelo
   ```

3. Abrir **http://localhost:3000** e iniciar sesión con una de las
   [cuentas de la demo](#cuentas-de-la-demo). Usá `localhost`, no `127.0.0.1`:
   el CORE solo acepta pedidos (CORS) desde ese origen.

Para saber si arrancó bien, en la terminal de `npm run dev` tienen que aparecer:

- `[library] consumidor RabbitMQ listo (cola library.backoffice)`
- `[core] escuchando en 127.0.0.1:4000` y `[library] escuchando en 127.0.0.1:4001`
- `Ready` del frontend (Next.js)

**Para detenerlo:** `Ctrl+C` en la terminal de `npm run dev`, y
`docker compose stop` para apagar RabbitMQ y MariaDB (los datos se conservan).

## Problemas comunes

| Síntoma | Causa y solución |
|---|---|
| `RabbitMQ no disponible …; reintento en 5 s` en el log | RabbitMQ está apagado. Correr `docker compose up -d`; la Biblioteca se reconecta sola. Mientras tanto la app funciona igual |
| La Biblioteca termina con `No se pudo conectar a MariaDB` | MariaDB está apagada o Docker Desktop no está abierto. Abrir Docker y correr `docker compose up -d` |
| `error during connect … dockerDesktopLinuxEngine` | Docker Desktop no está corriendo. Abrirlo y esperar a que termine de iniciar |
| `EADDRINUSE` en 3000, 4000 o 4001 | Quedó otra instancia corriendo. Cerrar la otra terminal de `npm run dev` (o el proceso `node`) y volver a arrancar |
| El login falla con error de red o CORS | Abrir la app en `http://localhost:3000`, no en `127.0.0.1:3000` |
| Los préstamos de la demo aparecen todos vencidos | Los datos se cargaron hace muchos días. Resetearlos: ver [Base de datos](#base-de-datos-mariadb) |

Si el CORE está caído, los eventos de multa que la Biblioteca intenta enviarle
solo se registran en el log y no se reintentan.

## Otros comandos

```bash
npm test                                  # tests de core y library (MariaDB se saltea sin MARIADB_TEST_URL)
npm run typecheck                         # TypeScript en los cuatro componentes
npm run build -w @uadenet/frontend        # build de producción del frontend
npm run lint -w @uadenet/frontend
```

## Cuentas de la demo

| Perfil | Mail | Contraseña |
|---|---|---|
| Estudiante | `ana.garcia@uade.edu.ar` | `uade1234` |
| Bibliotecaria | `laura.fernandez@uade.edu.ar` | `uade1234` |
| Estudiante sin saldo (`u-camila`) | `camila.ruiz@uade.edu.ar` | `uade1234` |

Ana tiene saldo ($5000). Camila tiene saldo 0 (ver
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
MARIADB_TEST_URL=mariadb://biblioteca:biblioteca-dev@127.0.0.1:3306/biblioteca_test npm test -w @uadenet/library
```

En PowerShell:

```powershell
$env:MARIADB_TEST_URL="mariadb://biblioteca:biblioteca-dev@127.0.0.1:3306/biblioteca_test"; npm test -w @uadenet/library
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
