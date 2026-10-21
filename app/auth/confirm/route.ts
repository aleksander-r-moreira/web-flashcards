import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env } from "@/lib/server/env";
import { createClient } from "@/lib/server/supabase";

const TypeSchema = z.enum(["email", "signup", "recovery", "email_change"]);
const ALLOWED_NEXT = new Set(["/", "/auth/nova-senha"]);

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const site = env().SITE_URL;

  const tokenHash = params.get("token_hash");
  const type = TypeSchema.safeParse(params.get("type"));
  if (!tokenHash || tokenHash.length > 200 || !type.success) {
    return NextResponse.redirect(new URL("/login?erro=link", site));
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type.data });
  if (error) {
    console.error("Falha ao confirmar link de e-mail:", error.code);
    return NextResponse.redirect(new URL("/login?erro=link", site));
  }

  const requested = params.get("next") ?? "/";
  const destination = type.data === "recovery" ? "/auth/nova-senha" : ALLOWED_NEXT.has(requested) ? requested : "/";
  return NextResponse.redirect(new URL(destination, site));
}
