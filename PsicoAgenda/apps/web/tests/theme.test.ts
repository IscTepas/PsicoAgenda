import { afterEach, describe, expect, it, vi } from "vitest";

import {
  readPreferences,
  resolveIsDark,
  resolveTheme,
  THEME_ACCESSIBILITY,
  THEME_MODES,
  THEME_PALETTES,
  THEME_MODE_VALUES,
  THEME_PALETTE_CHOICES,
  THEME_PALETTE_VALUES,
} from "@/lib/theme";

describe("resolveTheme", () => {
  it("el modo y la paleta son independientes", () => {
    expect(resolveTheme({ mode: "dark", palette: "cereza" }, false)).toEqual({
      isDark: true,
      dataTheme: "cereza",
    });
    expect(resolveTheme({ mode: "light", palette: "oceano" }, true)).toEqual({
      isDark: false,
      dataTheme: "oceano",
    });
  });

  it("automático sigue al sistema y la paleta de marca no aplica data-theme", () => {
    expect(resolveTheme({ mode: "system", palette: "default" }, true)).toEqual({
      isDark: true,
      dataTheme: null,
    });
    expect(resolveTheme({ mode: "system", palette: "contraste" }, false)).toEqual({
      isDark: false,
      dataTheme: "contraste",
    });
  });

  it("resolveIsDark resuelve solo el modo", () => {
    expect(resolveIsDark("system", true)).toBe(true);
    expect(resolveIsDark("system", false)).toBe(false);
    expect(resolveIsDark("light", true)).toBe(false);
    expect(resolveIsDark("dark", false)).toBe(true);
  });
});

describe("catálogo de temas", () => {
  it("tiene tres modos, seis paletas estéticas y la de accesibilidad aparte", () => {
    expect(THEME_MODES.map((m) => m.value)).toEqual(["light", "dark", "system"]);
    expect(THEME_PALETTES.map((p) => p.value)).toEqual([
      "oceano",
      "bosque",
      "atardecer",
      "lavanda",
      "cereza",
      "sepia",
    ]);
    expect(THEME_ACCESSIBILITY.value).toBe("contraste");
  });

  it("las paletas del selector cubren todo el catálogo de paletas elegibles", () => {
    const valores = [...THEME_PALETTES.map((p) => p.value), THEME_ACCESSIBILITY.value];

    expect(valores.sort()).toEqual([...THEME_PALETTE_CHOICES].sort());
    expect([...THEME_PALETTE_VALUES].sort()).toEqual(["default", ...THEME_PALETTE_CHOICES].sort());
    expect([...THEME_MODE_VALUES]).toEqual(["light", "dark", "system"]);
  });
});

describe("preferencias guardadas", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function conStorage(inicial: Record<string, string>) {
    const datos = new Map(Object.entries(inicial));
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (clave: string) => datos.get(clave) ?? null,
        setItem: (clave: string, valor: string) => {
          datos.set(clave, valor);
        },
      },
    });
    return datos;
  }

  it("sin ventana devuelve los valores por defecto", () => {
    expect(readPreferences()).toEqual({ mode: "system", palette: "default" });
  });

  it("migra el formato anterior de paleta única a automático + esa paleta", () => {
    conStorage({ "psicoagenda-theme": "lavanda" });

    expect(readPreferences()).toEqual({ mode: "system", palette: "lavanda" });
  });

  it("migra el formato anterior de modo a paleta de marca", () => {
    conStorage({ "psicoagenda-theme": "dark" });

    expect(readPreferences()).toEqual({ mode: "dark", palette: "default" });
  });

  it("lee el formato nuevo con las dos claves", () => {
    conStorage({ "psicoagenda-theme": "dark", "psicoagenda-palette": "sepia" });

    expect(readPreferences()).toEqual({ mode: "dark", palette: "sepia" });
  });

  it("cae a los valores por defecto si el contenido no es válido", () => {
    conStorage({ "psicoagenda-theme": "xxx", "psicoagenda-palette": "yyy" });

    expect(readPreferences()).toEqual({ mode: "system", palette: "default" });
  });
});
