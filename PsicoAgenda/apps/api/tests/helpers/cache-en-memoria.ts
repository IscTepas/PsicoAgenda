import type { CacheStore } from "@/services/codigo-cache.repo";

/**
 * Almacén de códigos para las pruebas: mismo contrato que
 * `services/codigo-cache.repo.ts`, pero en un `Map` del proceso.
 *
 * La suite tiene que correr sin Postgres ni red, y el TTL se mueve con
 * `vi.setSystemTime`, así que el reloj lo pone la aplicación (`Date.now()`), no
 * la base. La implementación real (tabla `cache_registro`) se verifica en el
 * checklist de despliegue, que sí necesita una base de datos.
 */
export interface CacheEnMemoria {
  cacheRegistro: CacheStore;
  vaciar: () => void;
}

export function crearCacheEnMemoria(): CacheEnMemoria {
  const memoria = new Map<string, { valor: string; expiraEn: number }>();

  const cacheRegistro: CacheStore = {
    get(clave) {
      const entrada = memoria.get(clave);
      if (!entrada) return Promise.resolve(null);
      if (Date.now() >= entrada.expiraEn) {
        memoria.delete(clave);
        return Promise.resolve(null);
      }
      return Promise.resolve(entrada.valor);
    },

    set(clave, valor, ttlSeconds) {
      memoria.set(clave, { valor, expiraEn: Date.now() + ttlSeconds * 1000 });
      return Promise.resolve();
    },

    del(...claves) {
      for (const clave of claves) memoria.delete(clave);
      return Promise.resolve();
    },

    incr(clave, ttlSeconds) {
      const entrada = memoria.get(clave);
      if (!entrada || Date.now() >= entrada.expiraEn) {
        memoria.set(clave, { valor: "1", expiraEn: Date.now() + ttlSeconds * 1000 });
        return Promise.resolve(1);
      }
      const siguiente = Number(entrada.valor) + 1;
      memoria.set(clave, { valor: String(siguiente), expiraEn: entrada.expiraEn });
      return Promise.resolve(siguiente);
    },
  };

  return { cacheRegistro, vaciar: () => memoria.clear() };
}
