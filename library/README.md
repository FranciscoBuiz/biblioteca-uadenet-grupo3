# @uadenet/library

Modulo Biblioteca de UADEnet. Escucha solo en `127.0.0.1:4001`; el unico acceso es a traves del Gateway del CORE.

## Expone
- API REST `/api/v1/library/*` (contrato en `openapi.yaml`, Swagger en `/docs`). Exige `X-Gateway-Key` y las cabeceras de identidad del Gateway (`X-User-Id`, `X-User-Roles`, `X-Correlation-Id`).

## Consume
- CORE `/internal/v1/users` (lectores), `/internal/v1/wallets/{userId}/debits` (cobro de multas) y `/internal/v1/events` (evento `library.penalty.applied.v1`), con `X-Service-Key`. Timeout de 5 s; CORE caido responde 503 `CORE_UNAVAILABLE`.
- Job de atrasos: al arrancar y cada 1 h sanciona los prestamos con 8 dias o mas de atraso.

## Ejecutar
```
cp .env.example .env
npm run dev -w @uadenet/library     # o npm run dev en la raiz para todo el sistema
npm test -w @uadenet/library
```

## Variables de entorno
| Variable | Defecto | Uso |
|---|---|---|
| `PORT` | 4001 | puerto (siempre en 127.0.0.1) |
| `CORE_URL` | http://127.0.0.1:4000 | URL del CORE |
| `SERVICE_KEY` | (obligatoria) | `X-Service-Key` hacia el CORE |
| `GATEWAY_KEY` | (obligatoria) | `X-Gateway-Key` esperada del Gateway |
| `RABBITMQ_URL` | - | reservada para la mensajeria (Task 8) |
