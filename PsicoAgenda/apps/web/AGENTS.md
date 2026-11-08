<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Configuración de despliegue

El proyecto se despliega en Vercel. La configuración compartida vive en `vercel.json` en la raíz del workspace:

- **`regions: ["iad1"]`**: la región de las funciones serverless está cerca de la base de datos PostgreSQL (Supabase en `us-east-1`), reduciendo la latencia de las consultas.
- **`functions.maxDuration: 30`**: las funciones de la API (`apps/api/src/**/*.ts`) tienen un límite de 30 s, suficiente para la mayoría de endpoints y menor que el costo de funciones de 60 s, que se reservan para futuros reportes pesados.

Revisa el plan actual de Vercel antes de subir `maxDuration`, ya que valores por encima del default pueden tener implicaciones de facturación según el tier.
