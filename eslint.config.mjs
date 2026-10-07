import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({ baseDirectory: import.meta.dirname });

/** Reglas recomendadas de Next.js con comprobaciones de accesibilidad. */
const config = [
  // next-env.d.ts lo genera Next en cada build: no es codigo nuestro.
  { ignores: [".next/**", "node_modules/**", "next-env.d.ts"] },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default config;
