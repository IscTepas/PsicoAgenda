import type { NextConfig } from "next";

const DEFAULT_API_PORT = 4000;
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? `http://localhost:${DEFAULT_API_PORT}`;

const nextConfig: NextConfig = {
  // Oculta el indicador flotante de desarrollo (el círculo con "N").
  // Los errores de compilación y de runtime siguen mostrándose.
  devIndicators: false,
  // Silencia el registro de cada petición en desarrollo (GET /perfil 200 in …).
  // Los errores y los mensajes de compilación siguen visibles.
  logging: {
    incomingRequests: false,
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
