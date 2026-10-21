# CORE simulado (`@uadenet/core`)

Simula el CORE de UADEnet: login, Gateway hacia la Biblioteca, billetera y eventos. Todo en memoria.

## Expone
- `POST /api/v1/auth/login` `{email, password}` -> `{token, user}`. Contrasena de todos: `uade1234`.
- `GET /api/v1/wallets/me` (Bearer) -> `{balance, currency}`.
- `ALL /api/v1/library/*` (Bearer): Gateway. Valida el JWT y reenvia a la Biblioteca con `X-User-Id`, `X-User-Roles`, `X-User-Permissions`, `X-Gateway-Key`, `X-Correlation-Id`. Descarta los `X-User-*` del cliente. Biblioteca caida -> 502 `LIBRARY_UNAVAILABLE`.
- `/internal/v1/*` (header `X-Service-Key`): `GET users?ids=|q=`, `POST wallets/{userId}/debits`, `POST|GET events`.

## Consume
La Biblioteca en `LIBRARY_URL` (por defecto `http://127.0.0.1:4001`).

## Saldos
`u-ana` 5000, `u-laura` 0, **`u-camila` 0 (estudiante sin saldo, para probar el rechazo `INSUFFICIENT_FUNDS`)**, el resto 2500.

## Correr
Copiar `.env.example` a `.env` y completar `JWT_SECRET`, `GATEWAY_KEY` y `SERVICE_KEY` (el CORE no arranca sin ellas).
`npm run dev -w @uadenet/core` · `npm test -w @uadenet/core`
