import { createServerClient } from "@supabase/ssr";
import type { SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function redirectConCookies(
  request: NextRequest,
  response: NextResponse,
  pathname: string
) {
  const redirectResponse = NextResponse.redirect(
    new URL(pathname, request.url)
  );

  // getUser() puede renovar la sesión. Si el middleware decide redirigir,
  // esas cookies también tienen que viajar en la respuesta de redirect.
  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

function limpiarCookiesDeAutenticacion(
  request: NextRequest,
  response: NextResponse
) {
  let prefijoCookie: string | null = null;

  try {
    const projectRef = new URL(
      process.env.NEXT_PUBLIC_SUPABASE_URL!
    ).hostname.split(".")[0];
    prefijoCookie = `sb-${projectRef}-auth-token`;
  } catch {
    // La configuración inválida se informará al crear el cliente. No se borran
    // cookies si no podemos identificar con certeza las de este proyecto.
  }

  if (!prefijoCookie) return;

  request.cookies.getAll().forEach(({ name }) => {
    const esCookieDeSesion =
      name === prefijoCookie || name.startsWith(`${prefijoCookie}.`);

    if (!esCookieDeSesion) return;

    request.cookies.delete(name);
    response.cookies.set(name, "", { maxAge: 0, path: "/" });
  });
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: Parameters<SetAllCookies>[0]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );

          response = NextResponse.next({
            request,
          });

          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  let user = null;

  try {
    const resultado = await supabase.auth.getUser();
    user = resultado.data.user;
  } catch (error) {
    // Una cookie fragmentada o corrupta puede hacer que @supabase/ssr lance al
    // decodificarla, antes de poder devolver un AuthError normal.
    console.error("No se pudo leer la sesión de Supabase:", error);
    limpiarCookiesDeAutenticacion(request, response);
  }

  const rutasProtegidas = [
    "/arbol",
    "/archivo",
    "/bitacora",
  ];

  const necesitaLogin = rutasProtegidas.some((ruta) =>
    request.nextUrl.pathname.startsWith(ruta)
  );

  if (necesitaLogin && !user) {
    return redirectConCookies(request, response, "/login");
  }

  if (request.nextUrl.pathname === "/login" && user) {
    return redirectConCookies(request, response, "/arbol");
  }

  return response;
}

export const config = {
  matcher: [
    "/arbol/:path*",
    "/archivo/:path*",
    "/bitacora/:path*",
    "/login",
  ],
};
