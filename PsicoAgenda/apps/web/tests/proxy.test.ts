import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

/**
 * El proxy se prueba con un doble de `@supabase/ssr`: lo que importa es su decisión de
 * control de acceso (redirigir o dejar pasar según haya identidad verificada), no el
 * transporte de cookies de Supabase.
 */
const { getUser } = vi.hoisted(() => ({ getUser: vi.fn() }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: {
      getUser,
    },
  }),
}));

const { proxy } = await import("@/proxy");

const requestFor = (path: string) => new NextRequest(new URL(path, "https://psicoagenda.test"));

const AUTH_USER = { id: "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d" };

describe("proxy en rutas protegidas", () => {
  it("redirige a /login una petición sin sesión", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const response = await proxy(requestFor("/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://psicoagenda.test/login");
  });

  it("deja pasar una petición con sesión válida", async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } });

    const response = await proxy(requestFor("/dashboard"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("aplica la misma decisión a las rutas anidadas", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const response = await proxy(requestFor("/pacientes/3f2b1c4d"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://psicoagenda.test/login");
  });
});

describe("proxy en rutas de autenticación", () => {
  it("redirige a /dashboard a quien ya tiene sesión", async () => {
    getUser.mockResolvedValue({ data: { user: AUTH_USER } });

    const response = await proxy(requestFor("/login"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://psicoagenda.test/dashboard");
  });

  it("deja pasar el login a quien no tiene sesión", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    const response = await proxy(requestFor("/login"));

    expect(response.status).toBe(200);
  });
});
