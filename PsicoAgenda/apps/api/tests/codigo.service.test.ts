import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomInt } from "node:crypto";
import type * as NodeCrypto from "node:crypto";
import {
  CODIGO_TTL_SECONDS,
  MAX_INTENTOS,
  MAX_SOLICITUDES_POR_IP,
  REENVIO_COOLDOWN_SECONDS,
  consumirCodigo,
  generarCodigo,
  limitarSolicitudesPorIp,
  limpiarCacheRegistro,
  verificarCodigo,
} from "@/services/codigo.service";

// `generar6Digitos` usa `randomInt`: se envuelve para poder encadenar códigos
// deterministas y que ninguna prueba dependa de un azar de 1 entre 10^6.
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof NodeCrypto>();
  return { ...actual, randomInt: vi.fn(actual.randomInt) };
});

// Invariante de la capacidad: la BD no participa en absoluto. Cualquier acceso
// a Prisma (propiedad, método o consulta) revienta cada prueba del archivo.
const { prisma } = vi.hoisted(() => ({
  prisma: new Proxy(
    {},
    {
      get(_target, propiedad) {
        throw new Error(`La base de datos no debe tocarse (acceso a "${String(propiedad)}")`);
      },
    },
  ),
}));

vi.mock("@/lib/prisma", () => ({ prisma, disconnectPrisma: vi.fn() }));

const EMAIL = "persona@ejemplo.com";
const OTRO_CODIGO = "111111";

const codigoDiferenteDe = (codigo: string): string =>
  codigo === OTRO_CODIGO ? "222222" : OTRO_CODIGO;

const rechazaCon = async (promesa: Promise<unknown>, statusCode: number, code: string) => {
  await expect(promesa).rejects.toMatchObject({ statusCode, code });
};

/** Encadena valores para `randomInt` y devuelve el código de 6 dígitos esperado. */
const secuenciaDeCodigos = (...valores: number[]): string[] =>
  valores.map((valor) => {
    vi.mocked(randomInt).mockReturnValueOnce(valor);
    return String(valor).padStart(6, "0");
  });

beforeEach(async () => {
  vi.mocked(randomInt).mockReset().mockImplementation(() => Math.floor(Math.random() * 1_000_000));
  await limpiarCacheRegistro();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("generarCodigo", () => {
  it("devuelve un código de 6 dígitos numéricos", async () => {
    const [esperado] = secuenciaDeCodigos(42);

    const codigo = await generarCodigo(EMAIL);

    expect(codigo).toBe(esperado);
    expect(codigo).toMatch(/^\d{6}$/);
  });

  it("aplica el cooldown de reenvío de 60 segundos", async () => {
    await generarCodigo(EMAIL);

    await rechazaCon(generarCodigo(EMAIL), 429, "COOLDOWN");

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + REENVIO_COOLDOWN_SECONDS * 1000);

    await expect(generarCodigo(EMAIL)).resolves.toMatch(/^\d{6}$/);
  });

  it("invalida el código anterior al generar uno nuevo", async () => {
    const [codigoA, codigoB] = secuenciaDeCodigos(111111, 222222);
    await generarCodigo(EMAIL);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + REENVIO_COOLDOWN_SECONDS * 1000);
    const nuevo = await generarCodigo(EMAIL);

    expect(nuevo).toBe(codigoB);
    await rechazaCon(verificarCodigo(EMAIL, codigoA), 400, "CODIGO_INVALIDO");
    await expect(verificarCodigo(EMAIL, codigoB)).resolves.toBeUndefined();
  });
});

describe("verificarCodigo", () => {
  it("acepta el código generado", async () => {
    const [codigo] = secuenciaDeCodigos(42);
    await generarCodigo(EMAIL);

    await expect(verificarCodigo(EMAIL, codigo)).resolves.toBeUndefined();
  });

  it("tolera mayúsculas y espacios en el código escrito por la persona", async () => {
    const [codigo] = secuenciaDeCodigos(42);
    await generarCodigo(EMAIL);

    await expect(verificarCodigo(EMAIL, `  ${codigo.toUpperCase()} `)).resolves.toBeUndefined();
  });

  it("rechaza un código incorrecto sin consumir el vigente", async () => {
    const [codigo] = secuenciaDeCodigos(42);
    await generarCodigo(EMAIL);

    await rechazaCon(verificarCodigo(EMAIL, codigoDiferenteDe(codigo)), 400, "CODIGO_INVALIDO");

    // El intento fallido no invalida: el código correcto sigue sirviendo.
    await expect(verificarCodigo(EMAIL, codigo)).resolves.toBeUndefined();
  });

  it(`expira el código ${CODIGO_TTL_SECONDS} segundos después de generarlo`, async () => {
    const [codigo] = secuenciaDeCodigos(42);
    await generarCodigo(EMAIL);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + CODIGO_TTL_SECONDS * 1000 + 1);

    await rechazaCon(verificarCodigo(EMAIL, codigo), 410, "CODIGO_EXPIRADO");
  });

  it(`invalida el código tras ${MAX_INTENTOS} intentos fallidos`, async () => {
    const [codigo] = secuenciaDeCodigos(42);
    await generarCodigo(EMAIL);

    for (let intento = 0; intento < MAX_INTENTOS; intento++) {
      await rechazaCon(verificarCodigo(EMAIL, codigoDiferenteDe(codigo)), 400, "CODIGO_INVALIDO");
    }

    // El sexto intento, aunque fuera el correcto, ya no se evalúa.
    await rechazaCon(verificarCodigo(EMAIL, codigo), 429, "CODIGO_AGOTADO");
  });

  it("rechaza un código que nunca se generó para ese correo", async () => {
    await generarCodigo("otra@persona.com");

    await rechazaCon(verificarCodigo(EMAIL, "000000"), 410, "CODIGO_EXPIRADO");
  });
});

describe("consumirCodigo", () => {
  it("borra todas las claves para no dejar residuos", async () => {
    const [codigo] = secuenciaDeCodigos(42);
    await generarCodigo(EMAIL);
    await verificarCodigo(EMAIL, codigo);

    await consumirCodigo(EMAIL);

    await rechazaCon(verificarCodigo(EMAIL, codigo), 410, "CODIGO_EXPIRADO");
    // El cooldown también quedó liberado: puede pedir un código de inmediato.
    await expect(generarCodigo(EMAIL)).resolves.toMatch(/^\d{6}$/);
  });
});

describe("limitarSolicitudesPorIp", () => {
  it(`permite ${MAX_SOLICITUDES_POR_IP} solicitudes por IP y ventana`, async () => {
    for (let solicitud = 0; solicitud < MAX_SOLICITUDES_POR_IP; solicitud++) {
      await expect(limitarSolicitudesPorIp("203.0.113.7")).resolves.toBeUndefined();
    }

    await rechazaCon(limitarSolicitudesPorIp("203.0.113.7"), 429, "RATE_LIMIT");

    // Otra IP no arrastra el conteo de la primera.
    await expect(limitarSolicitudesPorIp("198.51.100.9")).resolves.toBeUndefined();
  });

  it("la ventana vuelve a abrirse al vencer", async () => {
    for (let solicitud = 0; solicitud < MAX_SOLICITUDES_POR_IP; solicitud++) {
      await limitarSolicitudesPorIp("203.0.113.7");
    }
    await rechazaCon(limitarSolicitudesPorIp("203.0.113.7"), 429, "RATE_LIMIT");

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 600_001);

    await expect(limitarSolicitudesPorIp("203.0.113.7")).resolves.toBeUndefined();
  });
});

describe("almacenamiento", () => {
  it("ejecuta el flujo completo sin tocar la base de datos", async () => {
    const [codigo] = secuenciaDeCodigos(42);

    // Si el servicio llegara a importar o consultar Prisma, el proxy del mock
    // lanza y esta prueba falla.
    await limitarSolicitudesPorIp("203.0.113.7");
    await generarCodigo(EMAIL);
    await verificarCodigo(EMAIL, codigo);
    await consumirCodigo(EMAIL);

    await expect(verificarCodigo(EMAIL, codigo)).rejects.toMatchObject({ code: "CODIGO_EXPIRADO" });
  });
});
