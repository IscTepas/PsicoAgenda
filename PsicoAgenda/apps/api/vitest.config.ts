import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    passWithNoTests: false,
    env: {
      // La suite corre sin base de datos y sin red. `SUPABASE_URL` solo se necesita
      // para que `@/utils/jwt` pueda construir el JWKS al importarse; ninguna prueba
      // contacta el proyecto real (el verificador se somete a `vi.mock`).
      SUPABASE_URL: "https://proyecto-prueba.supabase.co",
    },
  },
});
