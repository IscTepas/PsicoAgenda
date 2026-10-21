import { describe, expect, it } from "vitest";

import { dimensionesAvatar } from "@/lib/imagen";

describe("dimensionesAvatar", () => {
  it("reduce el lado mayor a 512 px conservando la proporción", () => {
    expect(dimensionesAvatar(2048, 1536)).toEqual({ ancho: 512, alto: 384 });
    expect(dimensionesAvatar(1536, 2048)).toEqual({ ancho: 384, alto: 512 });
  });

  it("no amplía imágenes que ya son pequeñas", () => {
    expect(dimensionesAvatar(64, 64)).toEqual({ ancho: 64, alto: 64 });
    expect(dimensionesAvatar(300, 200)).toEqual({ ancho: 300, alto: 200 });
  });

  it("respeta el lado máximo configurado y nunca deja dimensiones en cero", () => {
    expect(dimensionesAvatar(1000, 250, 100)).toEqual({ ancho: 100, alto: 25 });
    expect(dimensionesAvatar(1000, 1, 100)).toEqual({ ancho: 100, alto: 1 });
  });
});
