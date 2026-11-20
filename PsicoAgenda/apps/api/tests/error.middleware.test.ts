import { describe, expect, it, vi } from "vitest";
import type { Request, Response } from "express";
import { errorHandler } from "@/middleware/error.middleware";

const responder = () => {
  const res: { statusCode: number; body: unknown } = { statusCode: 0, body: undefined };
  return Object.assign(res, {
    status(code: number) {
      res.statusCode = code;
      return this;
    },
    json(body: unknown) {
      res.body = body;
      return this;
    },
  });
};

describe("errorHandler", () => {
  it("un CHECK violado en la base responde 400 con un mensaje claro, no 500", () => {
    const res = responder();
    const error = new Error('new row for relation "usuarios" violates check constraint "ck_usuarios_telefono" (23514)');

    errorHandler(error, {} as Request, res as unknown as Response, vi.fn());

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({ error: { code: "DATOS_INVALIDOS" } });
  });
});
