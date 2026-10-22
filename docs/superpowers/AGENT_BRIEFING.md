# Briefing para agentes — Frontend Biblioteca UADEnet

Leé este documento completo antes de escribir código. Define el contrato que
hace que las 22 pantallas se vean como un solo sistema.

## Qué es el proyecto

Frontend (sin backend) del módulo Biblioteca de UADEnet. Replica 22 mockups de
alta fidelidad que están en `Biblioteca UADEnet - Mockups.dc.html`, documentados
en `UADEnet_Biblioteca_Grupo3 (1).pdf`.

Stack: **Next.js 15 App Router + React 19 + TypeScript strict + Tailwind v4**.

## Cómo leer tu mockup — hacelo SIEMPRE antes de codear

Cada pantalla tiene su bloque en el HTML, marcado con `<!-- NN NOMBRE -->`.
Extraé el tuyo con HTML y estilos intactos:

```bash
python - <<'PY'
p=r'C:\Users\buizf\Desktop\TPO DESARROLLO DE APPS 2\Biblioteca UADEnet - Mockups.dc.html'
s=open(p,encoding='utf8').read()
i=s.index('<!-- 07 MIS'); j=s.index('<!-- 08 DETALLE')
print(s[i:j])
PY
```

Los marcadores existentes, en orden:
`01 LOGIN`, `02 DASHBOARD ESTUDIANTE`, `03 CATALOGO`, `04 DETALLE LIBRO`,
`05 CONFIRMACION`, `06 CONFIRMACION`, `07 MIS PRESTAMOS`, `08 DETALLE PRESTAMO`,
`09 DETALLE PRESTAMO`, `10 PAGO DE SANCION`, `11 PAGO DE SANCION`,
`12 NOTIFICACIONES DESPLEGABLE`, `13 TODAS LAS NOTIFICACIONES`,
`14 DASHBOARD BIBLIOTECARIO`, `15 GESTION CATALOGO`, `16 ALTA DE LIBRO`,
`17 EDITAR LIBRO`, `18 EJEMPLARES`, `19 STOCK POR SEDE`, `20 PRESTAMOS ADMIN`,
`21 DEVOLUCION`, `22 SANCIONES ADMIN`.

El HTML está en Latin-1 con mojibake (`pr�stamo`); los textos correctos en
castellano están en el PDF y en el seed. Copiá de ahí, no del mojibake.

Respetá del mockup: jerarquía, orden de los bloques, textos, paddings, colores
y tamaños de fuente. Lo que ya existe como primitiva, usalo en lugar de
reescribir estilos a mano.

## Reglas duras

1. **No edites archivos compartidos.** Son de solo lectura para vos:
   `src/lib/**`, `src/components/ui/**`, `src/components/shell/**`,
   `src/app/globals.css`, `src/app/layout.tsx`, `src/app/login/**`,
   `package.json`, `tsconfig.json`, y los layouts de los route groups.
   Si te falta una primitiva o un campo, **no lo agregues**: creá el componente
   dentro de tu propia carpeta de pantalla, o reportalo en tu resumen final.
2. **Creá únicamente los archivos de tu lista.** Nada fuera de ella.
3. **Todas las páginas son client components**: `"use client"` en la primera
   línea. Los datos viven en `localStorage`, el servidor no los ve.
4. **Next.js 15: `params` es una Promise.** En un client component no uses la
   prop `params`: usá `useParams()` de `next/navigation`.
   ```tsx
   const { isbn } = useParams<{ isbn: string }>();
   ```
5. **Castellano rioplatense** en todo el texto de interfaz y en los comentarios
   (igual que el resto del código: "Ingresá", "Devolvelo", "Tenés").
   Identificadores en castellano sin acentos (`prestamos`, `sancion`).
6. **Verificá antes de terminar**: `npx tsc --noEmit` tiene que salir limpio.
   Corré también `npx next build` si tocaste rutas dinámicas.
7. No instales dependencias. No agregues librerías de iconos: los iconos son
   SVG inline, como en `src/components/ui/Filtros.tsx`.

## Estructura de una pantalla

```tsx
"use client";

import { Cabecera, Contenido } from "@/components/shell/Cabecera";
import { BotonNotificaciones } from "@/components/shell/PanelNotificaciones";
import { useUsuarioActual } from "@/lib/store/LibraryProvider";

export default function MisPrestamos() {
  const usuario = useUsuarioActual();

  return (
    <>
      <Cabecera
        migas={[{ etiqueta: "Biblioteca" }, { etiqueta: "Mis préstamos" }]}
        titulo="Mis préstamos"
      >
        <BotonNotificaciones userId={usuario.id} />
      </Cabecera>

      <Contenido>{/* ... */}</Contenido>
    </>
  );
}
```

- `<Cabecera>` es la barra blanca superior: migas, título en serif, selector de
  sede y (en el área del estudiante) el desplegable de notificaciones como
  `children`. **Las pantallas de admin no llevan `BotonNotificaciones`.**
- `<Contenido>` aporta el padding del mockup. `ancho="angosto"` para fichas de
  detalle y formularios de una columna.
- El sidebar y la navegación mobile ya los pone el layout del route group. No
  los dibujes.

## Leer datos vs. mutar datos

**Para renderizar**, usá el store directo: es sincrónico y repinta solo.

```tsx
import { useDb } from "@/lib/store/LibraryProvider";
import { prestamosDe, librosConStock, indicadores } from "@/lib/store/selectors";

const db = useDb();
const mis = prestamosDe(db, usuario.id);   // LoanView[] ya con estado y días
```

**Para cambiar algo**, llamá a `lib/api/*` (async). La mutación repinta sola, no
hace falta refrescar nada a mano:

```tsx
import { createLoan } from "@/lib/api/loans";
import { mensajeDeError } from "@/lib/api/errors";

const [error, setError] = useState<string | null>(null);
const [enviando, setEnviando] = useState(false);

async function solicitar() {
  setError(null);
  setEnviando(true);
  try {
    const prestamo = await createLoan(isbn, sede, usuario.id);
    router.push(`/comprobante/${prestamo.id}`);
  } catch (e) {
    setError(mensajeDeError(e));
  } finally {
    setEnviando(false);
  }
}
```

Mostrá el error con `<Aviso tono="error">{error}</Aviso>` y pasá
`cargando={enviando}` al botón que disparó la acción.

## Catálogo de primitivas disponibles

### `@/components/shell/Cabecera`
`Cabecera({migas, titulo, acciones?, children?})`, `Contenido({children, ancho?})`,
`SelectorSede()`.

### `@/components/shell/PanelNotificaciones`
`BotonNotificaciones({userId})` — desplegable del header (pantalla 12).
`FilaNotificacion({notificacion})` — fila reutilizable para la pantalla 13.

### `@/components/ui/Boton`
`Boton({variante, tamano, ancho, cargando, ...props})` y `BotonLink({href, ...})`.
- `variante`: `confirmar` (verde, acción que confirma) · `avanzar` (azul) ·
  `neutro` (blanco con borde, para "Volver") · `peligro` (baja) · `texto`.
- `tamano`: `normal` · `chico` · `pill` (acciones de barra, tipo "Nuevo libro").

### `@/components/ui/Card`
- `Card({children, padding?})` — tarjeta blanca, borde `#E3E6EA`, radio 14px.
  Pasá `padding={false}` cuando adentro va una tabla o una lista de filas.
- `CardHeader({titulo, accion?})` — encabezado con separador.
- `StatCard({label, valor, pie?, tono?, href?})` — tarjeta de indicador.
  `tono`: `neutro` · `rojo` · `verde` · `azul`.
- `Hero({titulo, bajada, accion?})` — bloque azul del saludo.
- `Datos` + `Dato({label, children, destacado?})` — listas label/valor de las fichas.
- `Aviso({tono, titulo?, children})` — `info` · `alerta` · `error` · `ok`.

### `@/components/ui/StatusPill`
`Pill({tono, children})`, `EstadoPrestamoPill({estado, detalle?})`,
`EstadoEjemplarPill({estado})`, `EstadoSancionPill({estado})`,
`CategoriaPill`, `Disponibilidad({cantidad})`.

### `@/components/ui/Filtros`
`Tabs`, `Chips`, `Buscador`, `Toggle`, `SelectPill`, `BarraFiltros`.
Todos genéricos sobre `Opcion<T> = {id, etiqueta, cantidad?}`.

```tsx
const [tab, setTab] = useState<"activos" | "todos">("activos");
<Tabs opciones={[{id:"activos",etiqueta:"Activos"},{id:"todos",etiqueta:"Todos"}]}
      valor={tab} onChange={setTab} />
```

### `@/components/ui/Form`
`Campo` (input), `CampoTexto` (textarea), `CampoSelect`, `OpcionRadio`,
`GrillaCampos({columnas})`, `AccionesForm`.
Todos aceptan `label`, `error`, `ayuda`, `obligatorio`.

### `@/components/ui/Tabla`
`TablaDatos({columnas, filas, claveFila, vacio?, etiqueta})` — **usala para toda
tabla**. De una sola definición de columnas saca la tabla real en `md+` y
tarjetas apiladas en mobile.

```tsx
<Card padding={false}>
  <TablaDatos
    etiqueta="Préstamos del estudiante"
    filas={mis}
    claveFila={(p) => p.id}
    vacio={<SinResultados titulo="No tenés préstamos activos" detalle="..." />}
    columnas={[
      { clave: "libro", titulo: "Libro", principal: true,
        render: (p) => <CeldaDoble principal={p.libro.titulo} detalle={<Mono>{p.id}</Mono>} /> },
      { clave: "sede", titulo: "Sede", render: (p) => nombreSede(p.sede) },
      { clave: "limite", titulo: "Fecha límite", render: (p) => formatFecha(p.fechaLimite) },
      { clave: "estado", titulo: "Estado",
        render: (p) => <EstadoPrestamoPill estado={p.estado} detalle={detalleEstado(p)} /> },
      { clave: "accion", titulo: "Acción", accion: true, alinear: "derecha",
        render: (p) => <BotonLink href={`/prestamos/${p.id}`} tamano="pill">Ver detalle</BotonLink> },
    ]}
  />
</Card>
```
Marcá `principal: true` en la columna que encabeza la tarjeta mobile y
`accion: true` en las de botones. También exporta `SinResultados`,
`CeldaDoble({principal, detalle})` y `Mono` (para códigos tipo `BA-014`).

### `@/components/ui/Portada`
`Portada({titulo, tamano, mostrarTitulo?})` — tamaños `xs` (fila de lista),
`sm`, `md` (tarjeta de catálogo), `lg` (ficha de detalle). La maqueta no usa
imágenes: es una trama diagonal con el título encima.

## Reglas de negocio y formato — `@/lib/domain/rules`

**Nunca hardcodees estos valores ni recalcules fechas a mano.**

| Export | Qué es |
|---|---|
| `HOY` | `"2026-08-26"`, el "hoy" de la demo (la maqueta está fechada ahí) |
| `DIAS_PRESTAMO` | 14 |
| `DIAS_PARA_SANCION` | 8 (sanción desde el día 8 de atraso) |
| `MONTO_MULTA` | 2500 |
| `DIAS_RENOVACION` / `MAX_RENOVACIONES` | 3 / 2 |
| `SEDES`, `nombreSede(id)` | Monserrat, Belgrano, Pinamar |
| `formatFecha(iso)` | `"2026-08-26"` → `"26/08/2026"` |
| `formatMonto(n)` | `2500` → `"$2.500"` |
| `ETIQUETA_ESTADO[estado]` | etiqueta visible del estado de préstamo |
| `puedeRenovar(loan, sancion)` | `{puede, motivo}` — el `motivo` es texto listo para mostrar |
| `validarIsbn`, `validarObligatorio`, `validarAnio`, `validarCantidad` | devuelven `string \| null` |
| `sumarDias`, `diasEntre`, `parseFecha`, `aISO` | aritmética de fechas |

## Selectores — `@/lib/store/selectors`

`librosConStock(db)`, `buscarLibro(db, isbn)`, `ejemplaresDe(db, isbn)`,
`prestamos(db)`, `prestamosDe(db, userId)`, `prestamosVencidos(db)`,
`sanciones(db)`, `sancionesDe(db, userId)`, `sancionDe(db, loanId)`,
`tieneSancionPendiente(db, userId)`, `notificacionesDe(db, userId)`,
`sinLeer(db, userId)`, `indicadores(db, sede?)`, `categorias(db)`.

Tipos derivados: `BookWithStock` (con `totales`, `disponibles`, `prestados`,
`porSede`), `LoanView` (con `libro`, `estado`, `diasRestantes`, `diasAtraso`,
`sancion`), `PenaltyView` (con `libro`, `estudiante`).

## API — `@/lib/api/*`

- `books`: `getBooks(filtro)`, `getBook`, `getCopies`, `createBook`,
  `updateBook`, `setBookActivo`, `addCopies`, `setCopyEstado`.
- `loans`: `getLoans`, `filtrarPrestamos(filtro)` (sincrónica), `getLoan`,
  `getOverdueLoans`, `createLoan(isbn, sede, userId)`, `renewLoan(id)`,
  `returnLoan(id)` → `{prestamo, sancion}`.
- `penalties`: `getPenalties`, `filtrarSanciones(filtro)` (sincrónica),
  `getPenalty`, `payPenalty(id)` → comprobante (solo saldo institucional), `METODO_PAGO`.
- `notifications`: `filtrarNotificaciones(userId, filtro)`, `contarSinLeer`,
  `markAllRead`, `markRead`.
- `errors`: `ApiError`, `mensajeDeError(e)`.

Las mutaciones ya generan por su cuenta las notificaciones del estudiante y las
entradas del feed de actividad del bibliotecario. No las dupliques.

## Clases de Tailwind del design system

Colores: `institucional` `#1A2B4B` · `secundario` `#2D5DA1` · `verde` `#127453`
· `rojo` `#D32F2F` · `fondo` `#F8F9FA` · `borde` `#E3E6EA` · `borde-fuerte`
`#DDE2E8` · `borde-suave` `#EDF0F3` · `borde-fino` `#F1F3F6` · `tenue` `#5B6673`
· `apagado` `#8D97A4` · `grafito` `#3B4A63` · `aviso-bg` / `aviso-borde`.

Se usan como `bg-institucional`, `text-tenue`, `border-borde`, etc.

Radios: `rounded-tarjeta` (14px), `rounded-hero` (16px), `rounded-nav` (9px).
Sombra: `shadow-ventana`.

Clases utilitarias de `globals.css`:
- `.serif` — tipografía de títulos (Libre Caslon Text). Usala en **todo** título
  y en los números grandes de los indicadores.
- `.eyebrow` — label chico en mayúsculas de las tarjetas de indicador.
- `.lomo` — trama diagonal de portada.
- `.scroll-fino` — scrollbar discreta en contenedores con overflow.

## Responsive

- `≥1280px`: idéntico al mockup.
- `768–1279px`: grids `2fr 1fr` → una columna; las tablas scrollean (ya lo
  maneja `TablaDatos`).
- `<768px`: tablas → tarjetas apiladas (`TablaDatos` ya lo hace); grids de
  indicadores a 2 columnas; barras de filtros que envuelven.

Patrón para los grids del mockup:
```tsx
// grid-template-columns: 2fr 1fr
<div className="grid gap-4 lg:grid-cols-[2fr_1fr] lg:items-start">
// grid-template-columns: repeat(3,1fr)
<div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3">
// repeat(5,1fr) de los indicadores del admin
<div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 xl:grid-cols-5">
```

Nunca dejes scroll horizontal en la página a 360px de ancho.

## Accesibilidad — no es opcional

- Un solo `<h1>` por pantalla: lo pone `<Cabecera>` con el `titulo`. Dentro del
  contenido usá `<h2>`/`<h3>` (`CardHeader` ya emite un `<h2>`).
- Todo control que solo muestre un ícono necesita `aria-label`.
- Los `<svg>` decorativos llevan `aria-hidden`.
- Los errores de formulario van asociados al input (`Campo` ya lo hace con
  `aria-invalid` y `aria-describedby`).
- No uses `<div onClick>` para algo clickeable: `<button>` o `<Link>`.

## Qué devolver al terminar

Un resumen con:
1. Los archivos que creaste.
2. Qué pantalla del mockup cubre cada uno.
3. Desvíos del mockup y por qué.
4. Primitivas o datos que te faltaron (sin haberlos agregado vos).
5. La salida de `npx tsc --noEmit`.
