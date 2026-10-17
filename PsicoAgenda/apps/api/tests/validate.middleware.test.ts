import { describe, expect, it } from "vitest";
import { patientListQuerySchema } from "@psicoagenda/shared";
import { validate } from "@/middleware/validate.middleware";

interface FakeRequest {
  query: Record<string, unknown>;
  body?: unknown;
  params?: Record<string, string>;
}

/**
 * Reproduce la forma de un `req` de Express 5: `query` vive como getter en el
 * prototipo y cada acceso vuelve a parsear la URL, de modo que mutar el objeto
 * devuelto no persiste.
 */
function makeExpressLikeRequest(values: Record<string, string>): FakeRequest {
  const prototype = {
    get query() {
      return { ...values };
    },
  };

  return Object.create(prototype) as FakeRequest;
}

describe("validate middleware", () => {
  it("deja la query parseada como números en la request", () => {
    const req = makeExpressLikeRequest({ limit: "100", page: "2" });
    let nextCalled = false;

    validate({ query: patientListQuerySchema })(
      req as never,
      {} as never,
      () => {
        nextCalled = true;
      },
    );

    expect(nextCalled).toBe(true);
    // Se relee como la lee el controlador: el getter del prototipo ya no gana.
    expect(req.query).toEqual({ limit: 100, page: 2 });
  });

  it("responde 400 cuando la query no es válida", () => {
    const req = makeExpressLikeRequest({ limit: "0" });
    let error: unknown;

    validate({ query: patientListQuerySchema })(
      req as never,
      {} as never,
      (validationError?: unknown) => {
        error = validationError;
      },
    );

    expect(error).toMatchObject({ statusCode: 400 });
  });
});
