# Backoffice simulado

CLI que publica en RabbitMQ (exchange topic `backoffice.events`, mensajes persistentes) los mensajes que consume la Biblioteca.
Requiere RabbitMQ (`docker compose up -d`). URL por `RABBITMQ_URL` (por defecto `amqp://guest:guest@127.0.0.1:5672`).

| Comando | Routing key | Mensaje |
|---|---|---|
| `npm run publish:rate -w @uadenet/backoffice -- 3000 [YYYY-MM-DD]` | `backoffice.rate.changed.v1` | nueva multa `LIBRARY_LATE_FEE` en ARS, vigente desde la fecha (hoy por defecto) |
| `npm run publish:location -w @uadenet/backoffice -- sede-monserrat "Biblioteca - PB" 120` | `backoffice.location.upserted.v1` | ubicacion de una sede (`sede-monserrat`, `sede-belgrano`, `sede-pinamar`) |
| `npm run publish:invalid -w @uadenet/backoffice` | `backoffice.rate.changed.v1` | JSON roto: termina en la cola `library.dlq` |

Sale con codigo 0 si RabbitMQ confirma el mensaje y con 1 si no responde.
