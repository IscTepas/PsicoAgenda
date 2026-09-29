import { SignJWT, generateKeyPair } from "jose";
import type { GenerateKeyPairResult } from "jose";
import type * as Jose from "jose";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { UserRole } from "@psicoagenda/shared";
import { UserRole as SchemaRole } from "@/generated/prisma/enums";

type PublicKey = GenerateKeyPairResult["publicKey"];

/**
 * El verificador se prueba contra un JWKS local: la red no participa. Se sustituye
 * únicamente la resolución de claves remotas, de modo que `jwtVerify` sigue siendo el
 * de `jose` de verdad, incluida la validación de `issuer` y `audience`.
 */
const { jwksRef } = vi.hoisted(() => ({ jwksRef: { key: null as PublicKey | null } }));

vi.mock("jose", async (importOriginal) => {
  const actual = await importOriginal<typeof Jose>();
  return {
    ...actual,
    createRemoteJWKSet: () => () => Promise.resolve(jwksRef.key),
  };
});

const { verifyToken } = await import("@/utils/jwt");

const ISSUER = "https://proyecto-prueba.supabase.co/auth/v1";
const AUDIENCE = "authenticated";
const SUBJECT = "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";

let issuerKeys: GenerateKeyPairResult;
let foreignKeys: GenerateKeyPairResult;

const signFor = (keys: GenerateKeyPairResult, claims: Record<string, unknown>, expiresIn: string) =>
  new SignJWT(claims)
    .setProtectedHeader({ alg: "ES256" })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setSubject(SUBJECT)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(keys.privateKey);

beforeAll(async () => {
  issuerKeys = await generateKeyPair("ES256", { extractable: true });
  foreignKeys = await generateKeyPair("ES256", { extractable: true });
  jwksRef.key = issuerKeys.publicKey;
});

describe("verifyToken", () => {
  it("resuelve la identidad de una sesión válida", async () => {
    const token = await signFor(
      issuerKeys,
      { email: "ana@psicoagenda.test", app_metadata: { role: UserRole.PSYCHOLOGIST } },
      "1h",
    );

    await expect(verifyToken(token)).resolves.toEqual({
      id: SUBJECT,
      email: "ana@psicoagenda.test",
      role: UserRole.PSYCHOLOGIST,
    });
  });

  it("rechaza un token firmado con una clave ajena al proyecto", async () => {
    const token = await signFor(
      foreignKeys,
      { email: "ana@psicoagenda.test", app_metadata: { role: UserRole.PSYCHOLOGIST } },
      "1h",
    );

    await expect(verifyToken(token)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rechaza una credencial caducada", async () => {
    const token = await signFor(
      issuerKeys,
      { email: "ana@psicoagenda.test", app_metadata: { role: UserRole.PSYCHOLOGIST } },
      "-1h",
    );

    await expect(verifyToken(token)).rejects.toMatchObject({
      statusCode: 401,
      message: "La sesión expiró, vuelve a iniciar sesión",
    });
  });

  it("rechaza una sesión sin app_metadata.role en lugar de degradar a paciente", async () => {
    const token = await signFor(issuerKeys, { email: "ana@psicoagenda.test" }, "1h");

    await expect(verifyToken(token)).rejects.toMatchObject({
      statusCode: 401,
      message: "La sesión no declara un rol de aplicación",
    });
  });

  it("rechaza un rol de aplicación desconocido", async () => {
    const token = await signFor(
      issuerKeys,
      { email: "ana@psicoagenda.test", app_metadata: { role: "superusuario" } },
      "1h",
    );

    await expect(verifyToken(token)).rejects.toMatchObject({ statusCode: 401 });
  });

  it("rechaza un token emitido por otra issuer", async () => {
    const token = await new SignJWT({ app_metadata: { role: UserRole.PATIENT } })
      .setProtectedHeader({ alg: "ES256" })
      .setIssuer("https://otro-proyecto.supabase.co/auth/v1")
      .setAudience(AUDIENCE)
      .setSubject(SUBJECT)
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(issuerKeys.privateKey);

    await expect(verifyToken(token)).rejects.toMatchObject({ statusCode: 401 });
  });
});

/**
 * Regresión del criterio de casing.
 *
 * Supabase escribe `app_metadata.role` con el enum de la base de datos, en
 * MAYÚSCULAS. Las pruebas anteriores de este archivo usaban `UserRole` del paquete
 * compartido (minúsculas) tanto para firmar el token como para afirmar el
 * resultado, así que validaban un token que el proveedor nunca emite y el criterio
 * de comparación equivocado pasaba desapercibido: contra un token real, la API
 * respondía 401 a cualquier sesión.
 *
 * Estos casos fijan el contrato con el formato que sí llega de Supabase.
 */
describe("verifyToken con el claim real del proveedor (MAYÚSCULAS)", () => {
  it.each([
    [SchemaRole.PSYCHOLOGIST, UserRole.PSYCHOLOGIST],
    [SchemaRole.PATIENT, UserRole.PATIENT],
    [SchemaRole.ADMIN, UserRole.ADMIN],
  ])("mapea %s del enum de la BD a %s del enum compartido", async (schemaRole, expected) => {
    const token = await signFor(
      issuerKeys,
      { email: "ana@psicoagenda.test", app_metadata: { role: schemaRole } },
      "1h",
    );

    await expect(verifyToken(token)).resolves.toEqual({
      id: SUBJECT,
      email: "ana@psicoagenda.test",
      role: expected,
    });
  });

  it("acepta el rol en minúsculas, como el disparador de alta", async () => {
    const token = await signFor(
      issuerKeys,
      { email: "ana@psicoagenda.test", app_metadata: { role: "psychologist" } },
      "1h",
    );

    await expect(verifyToken(token)).resolves.toMatchObject({ role: UserRole.PSYCHOLOGIST });
  });

  it("rechaza un rol en mayúsculas que no pertenece al dominio", async () => {
    const token = await signFor(
      issuerKeys,
      { email: "ana@psicoagenda.test", app_metadata: { role: "SUPERADMIN" } },
      "1h",
    );

    await expect(verifyToken(token)).rejects.toMatchObject({
      statusCode: 401,
      message: "La sesión no declara un rol de aplicación",
    });
  });

  it("rechaza un rol que no es texto", async () => {
    const token = await signFor(
      issuerKeys,
      { email: "ana@psicoagenda.test", app_metadata: { role: ["PSYCHOLOGIST"] } },
      "1h",
    );

    await expect(verifyToken(token)).rejects.toMatchObject({ statusCode: 401 });
  });
});
