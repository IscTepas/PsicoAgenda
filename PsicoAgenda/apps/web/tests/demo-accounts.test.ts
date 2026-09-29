import { describe, expect, it } from "vitest";

import { parseDemoAccounts } from "@/lib/demo-accounts";

/**
 * El parser se prueba aislado del entorno: `demoAccounts` lee una variable real, pero lo
 * que interesa comprobar es como tolera un valor mal puesto, porque una variable
 * corrupta en `.env` no debe dejar la pagina de login sin renderizar.
 */
const VALIDO = JSON.stringify([
  {
    label: "Paciente",
    email: "paciente.demo@example.com",
    password: "123456",
    role: "patient",
    navItems: 4,
  },
]);

describe("parseDemoAccounts", () => {
  it("devuelve las cuentas de una variable bien formada", () => {
    const cuentas = parseDemoAccounts(VALIDO);

    expect(cuentas).toHaveLength(1);
    expect(cuentas[0]).toMatchObject({
      label: "Paciente",
      email: "paciente.demo@example.com",
      password: "123456",
      role: "patient",
      navItems: 4,
    });
  });

  it("devuelve una lista vacia si la variable no esta definida", () => {
    expect(parseDemoAccounts(undefined)).toEqual([]);
    expect(parseDemoAccounts("")).toEqual([]);
  });

  it("devuelve una lista vacia si el JSON esta mal formado", () => {
    expect(parseDemoAccounts("{no es json")).toEqual([]);
  });

  it("devuelve una lista vacia si el valor no es un array", () => {
    expect(parseDemoAccounts('{"email":"a@b.test"}')).toEqual([]);
  });

  it("descarta las entradas con campos obligatorios ausentes o invalidos", () => {
    const casos = [
      '[{"email":"a@b.test","password":"x","role":"patient","navItems":1}]', // sin label
      '[{"label":"A","password":"x","role":"patient","navItems":1}]', // sin email
      '[{"label":"A","email":"a@b.test","role":"patient","navItems":1}]', // sin password
      '[{"label":"A","email":"a@b.test","password":"x","navItems":1}]', // sin role
      '[{"label":"A","email":"a@b.test","password":"x","role":"patient"}]', // sin navItems
      '[{"label":"A","email":"a@b.test","password":"x","role":"terapeuta","navItems":1}]', // rol desconocido
      '[{"label":"A","email":"a@b.test","password":"x","role":"patient","navItems":"cuatro"}]', // navItems no numerico
      "[null, 7]", // valores que no son objetos
    ];

    for (const caso of casos) {
      expect(parseDemoAccounts(caso)).toEqual([]);
    }
  });

  it("conserva las entradas validas y descarta las invalidas de una lista mixta", () => {
    const [valida] = JSON.parse(VALIDO) as Array<Record<string, unknown>>;

    const cuentas = parseDemoAccounts(
      JSON.stringify([valida, { label: "Roto", email: "x@y.test" }]),
    );

    expect(cuentas).toHaveLength(1);
    expect(cuentas[0].role).toBe("patient");
  });
});
