import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UserRole } from "@psicoagenda/shared";

const { findUnique, queryRaw } = vi.hoisted(() => ({
  findUnique: vi.fn(),
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: queryRaw, user: { findUnique } },
  disconnectPrisma: vi.fn(),
}));

const { createApp } = await import("@/app");

const app = createApp();

const USER_ID = "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

interface ErrorBody {
  error: { code: string; message: string };
}

beforeEach(() => {
  findUnique.mockReset();
  queryRaw.mockReset();
  queryRaw.mockResolvedValue([{ "1": 1 }]);
});

describe("GET /api/auth/me", () => {
  it("rechaza la petición sin credencial antes de resolver datos de negocio", async () => {
    const response = await request(app).get("/api/auth/me");
    const body = response.body as ErrorBody;

    expect(response.status).toBe(401);
    expect(body.error.code).toBe("UNAUTHORIZED");
    // La ruta protegida no debe tocar la base de datos si no hay credencial válida.
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("rechaza un encabezado Authorization mal formado", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer");

    expect(response.status).toBe(401);
  });

  it("rechaza un token manipulado sin ejecutar ninguna acción", async () => {
    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", "Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhdGFjayJ9.firma-falsa");

    expect(response.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });
});

describe("getProfileById", () => {
  it("devuelve el perfil espejado con el rol en el formato de la sesión", async () => {
    findUnique.mockResolvedValue({
      id: USER_ID,
      email: "ana@psicoagenda.test",
      name: "Dra. Ana García",
      role: "PSYCHOLOGIST",
      isActive: true,
    });

    const { getProfileById } = await import("@/services/auth.service");

    await expect(getProfileById(USER_ID)).resolves.toEqual({
      id: USER_ID,
      email: "ana@psicoagenda.test",
      name: "Dra. Ana García",
      role: UserRole.PSYCHOLOGIST,
    });
  });

  it("rechaza una identidad cuyo perfil no existe", async () => {
    findUnique.mockResolvedValue(null);

    const { getProfileById } = await import("@/services/auth.service");

    await expect(getProfileById(USER_ID)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rechaza un perfil deshabilitado por un bloqueo de la identidad", async () => {
    findUnique.mockResolvedValue({
      id: USER_ID,
      email: "ana@psicoagenda.test",
      name: "Dra. Ana García",
      role: "PSYCHOLOGIST",
      isActive: false,
    });

    const { getProfileById } = await import("@/services/auth.service");

    await expect(getProfileById(USER_ID)).rejects.toMatchObject({ statusCode: 403 });
  });
});
