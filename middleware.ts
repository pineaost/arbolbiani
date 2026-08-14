import { createServerClient } from "@supabase/ssr";
import type { SetAllCookies } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const rutasProtegidas = [
    "/arbol",
    "/archivo",
    "/bitacora",
  ];

  const necesitaLogin = rutasProtegidas.some((ruta) =>
    request.nextUrl.pathname.startsWith(ruta)
  );

  if (necesitaLogin && !user) {
    return NextResponse.redirect(
      new URL("/login", request.url)
    );
  }

  if (request.nextUrl.pathname === "/login" && user) {
    return NextResponse.redirect(
      new URL("/arbol", request.url)
    );
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
