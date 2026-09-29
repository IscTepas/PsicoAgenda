import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/agenda",
  "/pacientes",
  "/notificaciones",
  "/reportes",
  "/perfil",
];

const PUBLIC_AUTH_PATHS = ["/login", "/registro"];

const isSupabaseConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  const isAuthPath = PUBLIC_AUTH_PATHS.includes(pathname);

  if (!isProtected && !isAuthPath) {
    return NextResponse.next();
  }

  if (!isSupabaseConfigured()) {
    // Sin proyecto configurado no hay nada que verificar. En las rutas protegidas se
    // prefiere redirigir a login (fallo cerrado) a mostrar el shell sin sesión.
    return isProtected
      ? NextResponse.redirect(new URL("/login", request.url))
      : NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          // Se renuevan las cookies de la sesión: la credencial de acceso es corta y
          // la renovación ocurre aquí, en el borde, para no dejar caducar la sesión
          // mientras el usuario navega.
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // `getUser()` valida el token contra el proveedor. Es una ida a la red por petición:
  // es el precio de no decidir la identidad a partir de una bandera que el navegador
  // puede falsear (antes bastaba con que existiera una cookie centinela).
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtected && !user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isAuthPath && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
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
