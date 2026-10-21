import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_OPTIONS } from "@/lib/supabase-cookies";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/confirm", "/visitante"];

export async function proxy(request: NextRequest) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return new NextResponse("Configuração incompleta: veja o README.", { status: 500 });
  }

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
      },
    },
  });

  const { pathname } = request.nextUrl;
  let loggedIn: boolean;
  if (pathname === "/login" || pathname === "/visitante") {
    const { data, error } = await supabase.auth.getUser();
    loggedIn = Boolean(data.user) && !error;
    if (!loggedIn && request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) {
      await supabase.auth.signOut({ scope: "local" });
    }
  } else {
    const { data } = await supabase.auth.getClaims();
    loggedIn = Boolean(data?.claims);
  }
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isApi = pathname.startsWith("/api/");

  if (!loggedIn && !isPublic && !isApi) return redirectWithCookies(request, response, "/login");
  if (loggedIn && (pathname === "/login" || pathname === "/visitante")) return redirectWithCookies(request, response, "/");
  return response;
}

function redirectWithCookies(request: NextRequest, from: NextResponse, path: string) {
  const redirect = NextResponse.redirect(new URL(path, request.url));
  from.cookies.getAll().forEach((c) => redirect.cookies.set(c));
  return redirect;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
