import { prisma } from "@/lib/prisma";

/**
 * Almacén de corta vida detrás de `codigo.service.ts`.
 *
 * La interfaz se mantiene a propósito: es el único punto que hay que cambiar si
 * algún día se prefiere Redis u otro almacén. Lo que cambió respecto a la
 * versión en memoria es el soporte: en serverless cada petición puede caer en
 * una instancia distinta, así que un `Map` del proceso no sirve — el código que
 * se generó en una lambda tiene que poder verificarse en otra.
 *
 * Postgres ya está en la ecuación, así que no hace falta un servicio nuevo. La
 * tabla `cache_registro` es pequeña y efímera: las filas vencidas se borran al
 * leerlas y en cada barrido del cron (`limpiarCacheRegistroVencida`).
 */
export interface CacheStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  del(...keys: string[]): Promise<void>;
  /** Incrementa un contador; si la clave es nueva la crea con TTL. */
  incr(key: string, ttlSeconds: number): Promise<number>;
}

interface FilaCache {
  valor: string;
  expira_en: Date;
}

export const cacheRegistro: CacheStore = {
  async get(clave) {
    const filas = await prisma.$queryRaw<FilaCache[]>`
      SELECT valor, expira_en FROM cache_registro WHERE clave = ${clave} LIMIT 1
    `;

    const fila = filas[0];
    if (!fila) return null;

    // Vencimiento perezoso: se comprueba contra el reloj de la aplicación, igual
    // que hacía la versión en memoria, y se borra en el acto.
    if (fila.expira_en.getTime() <= Date.now()) {
      await cacheRegistro.del(clave);
      return null;
    }

    return fila.valor;
  },

  async set(clave, valor, ttlSeconds) {
    const expiraEn = new Date(Date.now() + ttlSeconds * 1000);

    await prisma.cache_registro.upsert({
      where: { clave },
      create: { clave, valor, expira_en: expiraEn },
      update: { valor, expira_en: expiraEn },
    });
  },

  async del(...claves) {
    if (claves.length === 0) return;
    await prisma.cache_registro.deleteMany({ where: { clave: { in: claves } } });
  },

  async incr(clave, ttlSeconds) {
    const ahora = new Date();
    const expiraEn = new Date(ahora.getTime() + ttlSeconds * 1000);

    // Un solo viaje a la base: el `ON CONFLICT` decide entre crear, reiniciar la
    // ventana vencida o sumar. Así dos instancias concurrentes no se pisan el
    // contador (que es justo lo que protegía el rate limit por IP).
    const filas = await prisma.$queryRaw<{ valor: string }[]>`
      INSERT INTO cache_registro (clave, valor, expira_en, actualizado_en)
      VALUES (${clave}, '1', ${expiraEn}, ${ahora})
      ON CONFLICT (clave) DO UPDATE SET
        valor = CASE
                  WHEN cache_registro.expira_en <= ${ahora} THEN '1'
                  ELSE ((cache_registro.valor)::int + 1)::text
                END,
        expira_en = CASE
                      WHEN cache_registro.expira_en <= ${ahora} THEN EXCLUDED.expira_en
                      ELSE cache_registro.expira_en
                    END,
        actualizado_en = ${ahora}
      RETURNING valor
    `;

    return Number(filas[0]?.valor ?? 1);
  },
};

/** Borra las filas vencidas. Lo llama el barrido del cron, una vez por vuelta. */
export async function limpiarCacheRegistroVencida(): Promise<number> {
  const { count } = await prisma.cache_registro.deleteMany({
    where: { expira_en: { lt: new Date() } },
  });
  return count;
}

/** Vacía la tabla. Solo para pruebas con el almacén sustituido por uno falso. */
export async function vaciarCacheRegistro(): Promise<void> {
  await prisma.cache_registro.deleteMany({});
}
