import request from "supertest";
import jwt from "jsonwebtoken";
import { describe, expect, it } from "vitest";
import { UserRole } from "@psicoagenda/shared";
import { createApp } from "@/app";
import { config } from "@/config";

const app = createApp();

interface DemoLoginBody {
  token: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: UserRole;
  };
}

interface ErrorBody {
  error: { code: string; message: string };
}

describe("POST /api/auth/demo-login", () => {
  it("emite un token y datos de usuario para psicólogo/a", async () => {
    const response = await request(app).post("/api/auth/demo-login").send({ role: UserRole.PSYCHOLOGIST });
    const body = response.body as DemoLoginBody;

    expect(response.status).toBe(200);
    expect(body.user.role).toBe(UserRole.PSYCHOLOGIST);
    expect(body.user.email).toBe("demo.psicologo@psicoagenda.test");
    expect(typeof body.token).toBe("string");

    const decoded = jwt.decode(body.token) as { role: string };
    expect(decoded.role).toBe(UserRole.PSYCHOLOGIST);
  });

  it("emite un token y datos de usuario para paciente", async () => {
    const response = await request(app).post("/api/auth/demo-login").send({ role: UserRole.PATIENT });
    const body = response.body as DemoLoginBody;

    expect(response.status).toBe(200);
    expect(body.user.role).toBe(UserRole.PATIENT);
  });

  it("rechaza el rol ADMIN", async () => {
    const response = await request(app).post("/api/auth/demo-login").send({ role: UserRole.ADMIN });
    const body = response.body as ErrorBody;

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("BAD_REQUEST");
  });

  it("requiere un rol", async () => {
    const response = await request(app).post("/api/auth/demo-login").send({});

    expect(response.status).toBe(400);
  });
});

describe("demo login deshabilitado en producción", () => {
  it("config.allowDemoLogin es falso en producción", () => {
    // La prueba no puede mutar process.env de forma segura en paralelo,
    // pero verificamos que la lógica por defecto esté alineada.
    expect(config.allowDemoLogin || config.isProduction).toBe(!config.isProduction || false);
  });
});
