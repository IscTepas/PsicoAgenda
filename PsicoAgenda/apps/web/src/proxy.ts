import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { tryFastAuthCheck } from "@/lib/supabase/fast-auth-check";
import { withTimeout, TimeoutError, STALE_SUPABASE_AUTH_COOKIE, AUTH_CHECK_TIMEOUT_MS } from "@/lib/with-timeout";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/agenda",
  "/pacientes",
  "/notificaciones",
  "/reportes",
  "/motivos",
  "/perfil",
];

const PUBLIC_AUTH_PATHS = ["/login", "/registro"];

const isSupabaseConfigured = () =>
  Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

/**
 * Borra las cookies de sesión que quedaron caducas tras un timeout de red: sin
 * esto, cada navegación futura volvería a pagar el mismo costo de reintentos
 * del SDK contra un proveedor inalcanzable.
 */
function clearStaleAuthCookies(request: NextRequest, response: NextResponse) {
  for (const cookie of request.cookies.getAll()) {
    if (STALE_SUPABASE_AUTH_COOKIE.test(cookie.name)) {
      response.cookies.set(cookie.name, "", { path: "/", maxAge: 0 });
    }
  }
}

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

  // Vía rápida: valida la firma y expiración del token localmente (sin red) a
  // partir de la cookie. Si la sesión sigue vigente, esto basta y nunca se
  // llega a tocar la red, ni siquiera cuando el proveedor está inalcanzable.
  let user: { id: string; email?: string } | null = await tryFastAuthCheck(
    supabase,
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (name) => request.cookies.get(name)?.value,
  );

  let authTimedOut = false;

  if (!user) {
    // La vía rápida no pudo confirmar la sesión (token ausente, vencido o
    // inválido): `getUser()` valida contra el proveedor y, si hace falta,
    // refresca el token. Es el precio de no decidir la identidad a partir de
    // una bandera que el navegador puede falsear. Se acota con un timeout
    // porque, sin él, un refresh contra un proveedor inalcanzable reintenta
    // con backoff exponencial hasta 30s.
    try {
      const result = await withTimeout(supabase.auth.getUser(), AUTH_CHECK_TIMEOUT_MS);
      user = result.data.user;
    } catch (error) {
      if (error instanceof TimeoutError) {
        authTimedOut = true;
      } else {
        throw error;
      }
    }
  }

  if (isProtected && !user) {
    const redirectResponse = NextResponse.redirect(new URL("/login", request.url));
    if (authTimedOut) clearStaleAuthCookies(request, redirectResponse);
    return redirectResponse;
  }

  if (isAuthPath && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (authTimedOut) clearStaleAuthCookies(request, response);

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/agenda/:path*",
    "/pacientes/:path*",
    "/notificaciones/:path*",
    "/reportes/:path*",
    "/motivos/:path*",
    "/perfil/:path*",
    "/login",
    "/registro",
  ],
};
