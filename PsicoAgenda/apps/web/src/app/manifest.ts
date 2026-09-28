import type { MetadataRoute } from "next";

const themeColor = "#0f766e";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PsicoAgenda — Gestión de práctica clínica",
    short_name: "PsicoAgenda",
    description:
      "Agenda de citas, expediente clínico y recordatorios automáticos para profesionales de la psicología.",
    lang: "es-MX",
    dir: "ltr",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: themeColor,
    categories: ["productivity", "medical", "health"],
    icons: [
      {
        src: "/icons/icon-192x192.svg",
        sizes: "192x192",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-512x512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512x512.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Agenda de hoy",
        short_name: "Agenda",
        url: "/agenda",
      },
      {
        name: "Nuevo paciente",
        short_name: "Paciente",
        url: "/pacientes/nuevo",
      },
    ],
  };
}
