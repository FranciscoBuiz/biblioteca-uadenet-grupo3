import { crearApp } from "./app.js";

const env = (k: string, d = "") => process.env[k] ?? d;
const app = crearApp({
  jwtSecret: env("JWT_SECRET"), gatewayKey: env("GATEWAY_KEY"), serviceKey: env("SERVICE_KEY"),
  libraryUrl: env("LIBRARY_URL", "http://127.0.0.1:4001"),
  frontendOrigin: env("FRONTEND_ORIGIN", "http://localhost:3000"), log: true,
});
const puerto = Number(env("PORT", "4000"));
app.listen(puerto, () => console.log(`[core] escuchando en :${puerto}`));
