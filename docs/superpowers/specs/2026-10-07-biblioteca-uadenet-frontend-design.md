# UADEnet · Biblioteca Universitaria — Diseño del frontend

Fecha: 2026-10-07 · Entrega 1, Módulo 3 · Grupo 3

## Objetivo

Implementar el frontend navegable de las 22 pantallas de la maqueta
(`Biblioteca UADEnet - Mockups.dc.html`, documentadas en
`UADEnet_Biblioteca_Grupo3 (1).pdf`). **Sin backend**: la capa de datos es un
store en memoria cuyas funciones replican la firma de los endpoints del CORE
Gateway descritos en `UADEnet_Biblioteca_Grupo3.xlsx`.

## Stack

- Next.js 15 (App Router) + React 19 + TypeScript (strict)
- Tailwind CSS v4 con tokens derivados del mockup
- `next/font/google`: Libre Caslon Text (títulos) + Hanken Grotesk (texto)
- Sin API routes, sin server actions, sin base de datos

## Identidad visual (tokens)

| Token | Valor | Uso |
|---|---|---|
| `--azul-institucional` | `#1A2B4B` | Marca, sidebar, títulos, hero |
| `--azul-secundario` | `#2D5DA1` | Acciones secundarias, item activo, links |
| `--verde` | `#127453` | Confirmaciones, pagos, estados positivos |
| `--rojo` | `#D32F2F` | Vencimientos, sanciones, errores |
| `--fondo` | `#F8F9FA` | Fondo de áreas de contenido |
| `--borde` | `#E3E6EA` | Borde de tarjetas |
| `--borde-suave` | `#EDF0F3` / `#F1F3F6` | Separadores internos de tarjeta |
| `--texto-tenue` | `#5B6673` | Texto secundario |
| `--texto-apagado` | `#8D97A4` | Labels, breadcrumbs, metadatos |
| `--sidebar-texto` | `#B9C6DA` | Items inactivos del sidebar |
| `--sidebar-label` | `#8FA6C8` | Subtítulo de marca, rol del usuario |
| `--sidebar-borde` | `#2B3D5F` | Divisor y badges del sidebar |

Radios: 14px tarjetas, 16px hero, 9px items de nav, 999px pills.
Sombra de ventana: `0 20px 50px rgba(16,24,40,0.10)`.

Pills de estado (fondo / texto):

| Estado | Par |
|---|---|
| Próximo a vencer | `#FDF3E2` / `#8A5A11` |
| En curso | `#E8F1EC` / `#0E5C43` |
| Vencido · Sancionado | `#FDECEC` / `#9F2020` |
| Devuelto | `#EEF1F5` / `#5B6673` |

## Reglas de negocio (`lib/domain/rules.ts`)

- Plazo de préstamo: **14 días** corridos desde la solicitud.
- `proximo_a_vencer` cuando faltan **3 días o menos**.
- Sanción: se aplica a partir del **día 8** de atraso sobre la fecha límite.
- Multa: **$2.500 ARS** (`LIBRARY_LATE_FEE` del Backoffice).
- Renovación: **+3 días**, máximo **2 veces**, bloqueada si hay reservas.
- Validación de ISBN: **10 a 13 dígitos**.
- Un estudiante con sanción impaga no puede solicitar préstamos.
- Estados de préstamo: `en_curso`, `proximo_a_vencer`, `vencido`,
  `sancionado`, `devuelto`.
- Estados de ejemplar: `disponible`, `prestado`, `reservado`,
  `mantenimiento`, `baja`.
- Sedes: Monserrat (CABA), Belgrano, Pinamar.

## Modelo de dominio

```ts
User   { id, nombre, email, legajo, dni, rol: 'estudiante' | 'bibliotecario', sedeDefault }
Book   { isbn, titulo, autor, editorial, anio, categoria, descripcion, portada }
Copy   { codigo, isbn, sede, estado }                  // ejemplar físico, ej. BA-014
Loan   { id, isbn, copia, userId, sede, fechaPrestamo, fechaLimite,
         fechaDevolucion?, renovaciones, codigoRetiro, estado }
Penalty{ id, loanId, userId, isbn, monto, diasAtraso, fechaLimiteOriginal,
         fechaDeteccion, fechaCobro?, estado: 'pendiente' | 'cobrada' }
Notification { id, userId, tipo: 'sancion'|'vencimiento'|'comprobante',
               titulo, cuerpo, fecha, leida }
```

## Capa de datos

`lib/api/*` — funciones `async` espejo de los endpoints del xlsx:

| Función | Endpoint equivalente |
|---|---|
| `login(email, password)` | `POST /api/v1/auth/login` |
| `getBooks({q, sede, soloStock, categoria})` | `GET /api/v1/library/books?q=` |
| `getBook(isbn)` | `GET /api/v1/library/books/{isbn}` |
| `createBook`, `updateBook`, `deleteBook` | `/api/v1/library/books` |
| `addCopies(isbn, sede, cantidad)` | `/api/v1/library/copies` |
| `createLoan(isbn, sede)` | `POST /api/v1/library/loans` |
| `renewLoan(loanId)` | `POST /api/v1/library/loans/{id}/renew` |
| `returnLoan(loanId)` | `POST /api/v1/library/loans/{id}/return` |
| `payPenalty(penaltyId, metodo)` | `POST /internal/v1/wallets/{userId}/debits` |

Migrar al backend real = reemplazar el cuerpo por `fetch`; las vistas no cambian.

Estado global: `LibraryProvider` (Context + `useReducer`) sembrado desde
`lib/store/seed.ts` con los datos literales del mockup (Ana García, legajo
1102345; Laura Fernández, bibliotecaria; PRE-1001…1009; SAN-00031; ejemplares
BA-xxx). Persistencia en `localStorage` con acción **Reiniciar demo**.

## Mapa de pantallas → rutas

### Estudiante (1–13)

| # | Pantalla | Ruta |
|---|---|---|
| 01 | Login | `/login` |
| 02 | Inicio · Estudiante | `/inicio` |
| 03 | Catálogo de libros | `/catalogo` |
| 04 | Detalle de libro | `/catalogo/[isbn]` |
| 05 | Confirmación de solicitud | modal sobre `/catalogo/[isbn]` |
| 06 | Comprobante de préstamo | `/comprobante/[loanId]` |
| 07 | Mis préstamos | `/prestamos` |
| 08 | Detalle de préstamo | `/prestamos/[id]` |
| 09 | Detalle de sanción | `/sanciones/[id]` |
| 10 | Pago de la sanción | `/sanciones/[id]/pago` |
| 11 | Comprobante de pago | `/sanciones/[id]/pago/comprobante` |
| 12 | Notificaciones (desplegable) | componente del header, global |
| 13 | Todas las notificaciones | `/notificaciones` |

Listado de sanciones del estudiante: `/sanciones` (item del sidebar).

### Bibliotecario (14–22)

| # | Pantalla | Ruta |
|---|---|---|
| 14 | Inicio · Bibliotecario | `/admin` |
| 15 | Gestión de catálogo | `/admin/catalogo` |
| 16 | Alta de libro y ejemplares | `/admin/catalogo/nuevo` |
| 17 | Editar libro | `/admin/catalogo/[isbn]/editar` |
| 18 | Ejemplares del título | `/admin/catalogo/[isbn]/ejemplares` |
| 19 | Stock por sede | `/admin/stock` |
| 20 | Gestión de préstamos | `/admin/prestamos` |
| 21 | Mostrador de devolución | `/admin/devolucion` |
| 22 | Sanciones y multas | `/admin/sanciones` |

Sidebar estudiante: Inicio · Catálogo · Mis préstamos (badge) · Sanciones (badge).
Sidebar admin: Inicio · Catálogo · Stock por sede · Préstamos · Devoluciones · Sanciones.

## Flujos con estado real

- **Login** → dos usuarios demo; el rol decide el shell y un guard por route
  group corta el acceso cruzado.
- **Solicitar préstamo** → modal 05 → genera `PRE-xxxx` + `RET-xxxxxx`,
  descuenta el ejemplar del stock de la sede, aparece en `/prestamos` y en
  `/admin/prestamos`.
- **Renovar** → +3 días, incrementa `renovaciones`, se deshabilita en 2 de 2.
- **Devolución en mostrador** → busca por DNI/legajo/ID/comprobante, libera el
  ejemplar, cierra el préstamo y, si el atraso ≥ 8 días, genera la sanción que
  el estudiante ve al instante.
- **Pagar multa** → comprobante con nº de operación; desbloquea los préstamos.
- **Notificaciones** → dropdown global con badge y "marcar leídas" + vista
  completa filtrable (Todas, Sin leer, Vencimientos, Sanciones).

## Responsive

- `≥1280px`: idéntico al mockup (sidebar fijo de 236px, grids `2fr 1fr`).
- `768–1279px`: sidebar como drawer, grids a una columna, tablas con scroll
  horizontal.
- `<768px`: bottom-nav, tablas reorganizadas como tarjetas apiladas.

## Fuera de alcance

Backend, API routes, persistencia real, llamadas al CORE Gateway, débito real
de wallet, tests automatizados.

## Verificación

`npx tsc --noEmit` y `npm run build` sin errores, más recorrida manual de los
22 flujos comparando contra el mockup.
