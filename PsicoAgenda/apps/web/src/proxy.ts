import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/agenda",
  "/pacientes",
  "/notificaciones",
  "/reportes",
  "/perfil",
];

const PUBLIC_AUTH_PATHS = ["/login", "/registro"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has("pa_session");

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const isAuthPath = PUBLIC_AUTH_PATHS.includes(pathname);

  if (isProtected && !hasSession) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthPath && hasSession) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/agenda/:path*",
    "/pacientes/:path*",
    "/notificaciones/:path*",
    "/reportes/:path*",
    "/perfil/:path*",
    "/login",
    "/registro",
  ],
};
