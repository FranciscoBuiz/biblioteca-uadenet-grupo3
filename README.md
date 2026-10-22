# UADEnet · Biblioteca Universitaria — Frontend

Frontend del módulo Biblioteca de UADEnet. Implementa las 22 pantallas de la
maqueta de la Entrega 1, Módulo 3, para los dos perfiles de uso: **estudiante**
(catálogo, préstamos, sanciones, notificaciones) y **bibliotecario** (catálogo,
stock por sede, préstamos, devoluciones, sanciones).

Facultad de Ingeniería y Ciencias Exactas · Desarrollo de Aplicaciones II · Grupo 3
Barbieri · Brandt · Buiz · Marinoni · Sanguineti

## Cómo levantarlo

```bash
npm install               # en la raíz (workspaces)
cp .env.example .env      # credenciales de desarrollo de MariaDB
docker compose up -d      # RabbitMQ (5672, panel en 15672) y MariaDB (3306)
npm run dev               # frontend en http://localhost:3000
```

Otros comandos:

```bash
npm run build -w @uadenet/frontend       # build de producción
npm run typecheck                        # tsc --noEmit en los workspaces
npm run lint -w @uadenet/frontend
```

## Cuentas de la demo

| Perfil | Mail | Contraseña |
|---|---|---|
| Estudiante | `ana.garcia@uade.edu.ar` | `uade1234` |
| Bibliotecaria | `laura.fernandez@uade.edu.ar` | `uade1234` |

La pantalla de login tiene atajos para cargar cualquiera de las dos.

## Alcance: esto es solo frontend

**No hay backend.** No hay API routes, ni base de datos, ni llamadas al CORE
Gateway. Los datos viven en un store en memoria que se persiste en
`localStorage`, sembrado con los datos de la maqueta.

Lo que sí funciona de verdad, con estado compartido entre las dos vistas:

- Pedir un préstamo descuenta un ejemplar del stock de esa sede y aparece al
  instante en la vista del bibliotecario.
- Renovar suma 3 días y consume una de las 2 renovaciones disponibles.
- Registrar una devolución en el mostrador libera el ejemplar, cierra el
  préstamo y, si el atraso llegó al día 8, genera la sanción que el estudiante
  ve en el momento.
- Pagar la multa la marca como cobrada y desbloquea los préstamos.
- Las notificaciones se generan solas a partir de esas operaciones.

### El "hoy" de la demo está fijado

La maqueta está fechada el **26/08/2026** y los datos sembrados son relativos a
ese día, para que los estados coincidan con las capturas del PDF (PRE-1003 a 2
días de vencer, PRE-1002 con 3 días de atraso, PRE-1001 con 18).

Esa fecha es la constante `HOY` en `src/lib/domain/rules.ts`. Al conectar el
backend real, reemplazala por `new Date()`.

### Reiniciar los datos

El estado se guarda en `localStorage` bajo la clave `uadenet-biblioteca-v1`.
Para volver a los datos originales, borrá esa clave desde las DevTools del
navegador (Application → Local Storage) y recargá.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript** strict
- **Tailwind CSS v4** con tokens derivados de la maqueta
- `next/font/google` para Libre Caslon Text y Hanken Grotesk

Sin dependencias de UI de terceros: los componentes y los iconos son propios.

## Organización del código

```
src/
  app/
    login/                    01 · ingreso con mail institucional
    (student)/                02–13 · área del estudiante
    (admin)/admin/            14–22 · panel del bibliotecario
    layout.tsx               fuentes + LibraryProvider
    globals.css              tokens del design system
  components/
    shell/                   sidebar, cabecera, notificaciones, guard de rol
    ui/                      botones, tarjetas, pills, filtros, tablas, formularios
  lib/
    domain/   types.ts       entidades del dominio
              rules.ts       reglas de negocio y formato (única fuente de verdad)
    api/                     capa de datos con la forma de los endpoints reales
    store/    seed.ts        datos iniciales de la maqueta
              db.ts          base en memoria + persistencia
              selectors.ts   vistas derivadas
              LibraryProvider.tsx
```

### Por qué la capa de API está separada

`src/lib/api/*` expone funciones `async` cuyas firmas replican los endpoints
documentados en `UADEnet_Biblioteca_Grupo3.xlsx`:

| Función | Endpoint equivalente |
|---|---|
| `login(email, password)` | `POST /api/v1/auth/login` |
| `getBooks({q, sede, categoria, soloStock})` | `GET /api/v1/library/books?q=` |
| `createLoan(isbn, sede, userId)` | `POST /api/v1/library/loans` |
| `renewLoan(id)` | `POST /api/v1/library/loans/{id}/renew` |
| `returnLoan(id)` | `POST /api/v1/library/loans/{id}/return` |
| `payPenalty(id)` | `POST /internal/v1/wallets/{userId}/debits` |

Migrar al backend real es cambiar el cuerpo de esas funciones por un `fetch`.
Ninguna pantalla toca el store directamente para escribir, así que las vistas no
se modifican.

## Reglas de negocio

Todas centralizadas en `src/lib/domain/rules.ts`. No están repetidas en ninguna
pantalla.

| Regla | Valor |
|---|---|
| Plazo de préstamo | 14 días corridos |
| Próximo a vencer | faltan 3 días o menos |
| Umbral de sanción | día 8 de atraso |
| Monto de la multa | $2.500 ARS (`LIBRARY_LATE_FEE`) |
| Renovación | +3 días, máximo 2, bloqueada si hay reservas |
| Validación de ISBN | 10 a 13 dígitos |
| Bloqueo por deuda | con una multa impaga no se pueden pedir préstamos |
| Sedes | Monserrat (CABA), Belgrano, Pinamar |

## Mapa de pantallas

### Estudiante

| # | Pantalla | Ruta |
|---|---|---|
| 01 | Login | `/login` |
| 02 | Inicio | `/inicio` |
| 03 | Catálogo de libros | `/catalogo` |
| 04 | Detalle de libro | `/catalogo/[isbn]` |
| 05 | Confirmación de solicitud | modal sobre `/catalogo/[isbn]` |
| 06 | Comprobante de préstamo | `/comprobante/[id]` |
| 07 | Mis préstamos | `/prestamos` |
| 08 | Detalle de préstamo | `/prestamos/[id]` |
| 09 | Detalle de sanción | `/sanciones/[id]` |
| 10 | Pago de la sanción | `/sanciones/[id]/pago` |
| 11 | Comprobante de pago | paso 2 de `/sanciones/[id]/pago` |
| 12 | Notificaciones (desplegable) | componente global del header |
| 13 | Todas las notificaciones | `/notificaciones` |

El listado de sanciones del estudiante está en `/sanciones`.

### Bibliotecario

| # | Pantalla | Ruta |
|---|---|---|
| 14 | Panel de administración | `/admin` |
| 15 | Gestión de catálogo | `/admin/catalogo` |
| 16 | Alta de libro y ejemplares | `/admin/catalogo/nuevo` |
| 17 | Editar libro | `/admin/catalogo/[isbn]/editar` |
| 18 | Ejemplares del título | `/admin/catalogo/[isbn]/ejemplares` |
| 19 | Stock por sede | `/admin/stock` |
| 20 | Gestión de préstamos | `/admin/prestamos` |
| 21 | Mostrador de devolución | `/admin/devolucion` |
| 22 | Sanciones y multas | `/admin/sanciones` |

## Identidad visual

| Color | Uso |
|---|---|
| `#1A2B4B` azul institucional | marca, títulos, menú lateral |
| `#2D5DA1` azul secundario | acciones secundarias y acentos |
| `#127453` verde | confirmaciones y pagos |
| `#D32F2F` rojo | vencimientos, sanciones y errores |
| `#F8F9FA` neutro | fondo de las áreas de contenido |

Tipografías: **Libre Caslon Text** para títulos, **Hanken Grotesk** para texto,
labels y botones.

Los mockups están diseñados a 1280px. A ese ancho la app es fiel a la maqueta;
abajo de 1024px el menú lateral pasa a un drawer con navegación inferior, y
abajo de 768px las tablas se reorganizan como tarjetas apiladas.

## Verificación

```bash
npm run typecheck   # tsc --noEmit, limpio
npm run lint        # eslint, limpio
npm run build       # 23 rutas, sin errores ni warnings
```

Además se recorrieron los flujos en el navegador (Playwright sobre Edge),
comprobando entre otras cosas que:

- Los estados calculados coinciden con las capturas: PRE-1003 a 2 días de
  vencer, PRE-1002 con 3 días de atraso, PRE-1001 con 18, PRE-1005 devuelto el
  29/07/2026.
- Con la multa impaga el sistema rechaza el préstamo, y lo permite después de
  pagarla.
- No se puede pedir dos veces un título que sigue sin devolver.
- La fecha límite de un préstamo nuevo cae a 14 días (26/08 → 09/09/2026).
- Registrar la devolución de PRE-1002 (3 días de atraso) **no** genera sanción
  y devuelve el ejemplar BA-009 al stock disponible de Monserrat.
- El guard de rol saca a la bibliotecaria del área de estudiante.
- No hay scroll horizontal a 360px de ancho.

## Dos desvíos deliberados de la maqueta

1. **SAN-00031 arranca pendiente** en lugar de cobrada, para que el flujo
   "detalle de sanción → pago → comprobante" sea recorrible de punta a punta.
2. **Los contadores agregados se derivan de los datos** en lugar de estar
   fijos: las capturas 14, 15 y 19 no cierran entre sí (27 contra 18 ejemplares
   totales), así que preferimos un dataset internamente consistente.

Ambos están documentados en los comentarios de `src/lib/store/seed.ts`.
