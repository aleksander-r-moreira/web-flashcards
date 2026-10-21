import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/server/env";
import { createClient } from "@/lib/server/supabase";

const ALLOWED_NEXT = new Set(["/", "/auth/nova-senha"]);
const OTHER_BROWSER = new Set(["bad_code_verifier", "pkce_code_verifier_not_found", "flow_state_not_found"]);

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const site = env().SITE_URL;
  const next = params.get("next") ?? "/";
  const destination = ALLOWED_NEXT.has(next) ? next : "/";
  const toLogin = (erro: string) => NextResponse.redirect(new URL(`/login?erro=${erro}`, site));

  const code = params.get("code");
  if (params.get("error")) return toLogin(params.get("error_code") === "otp_expired" ? "expirado" : "link");
  if (!code || code.length > 200) return toLogin("link");

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("Falha no callback de autenticação:", error.code);
    if (error.code && OTHER_BROWSER.has(error.code)) {
      return toLogin(destination === "/auth/nova-senha" ? "outro-navegador-senha" : "outro-navegador");
    }
    return toLogin("link");
  }
  return NextResponse.redirect(new URL(destination, site));
}
