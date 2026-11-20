/**
 * Opciones de las transacciones interactivas que encadenan varias consultas.
 *
 * El default de Prisma es `timeout: 5_000` y `maxWait: 2_000`, pensado para una
 * base local. En serverless cada consulta cruza la red hasta Supabase y, con
 * `DATABASE_POOL_MAX=1`, una transacción puede esperar a que se libere la única
 * conexión del pool; 5 s se agotan con facilidad y Prisma aborta con `P2028`
 * («cannot be executed on an expired transaction»). `maxWait` cubre la espera
 * por la conexión y `timeout` la duración del callback. El límite superior es la
 * función de Vercel (`maxDuration: 30` en `vercel.json`).
 *
 * Vive en un módulo propio para que los tests puedan mockear `@/lib/prisma` sin
 * tener que declarar también esta constante.
 */
export const TRANSACTION_OPTIONS = { maxWait: 5_000, timeout: 15_000 } as const;
