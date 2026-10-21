import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SESSION_COOKIE_OPTIONS } from "@/lib/supabase-cookies";
import { env } from "./env";

export async function createClient() {
  const cookieStore = await cookies();
  const { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } = env();

  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookieOptions: SESSION_COOKIE_OPTIONS,
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, { ...options, ...SESSION_COOKIE_OPTIONS, maxAge: options.maxAge }),
          );
        } catch {
        }
      },
    },
  });
}

export function createAdminClient() {
  const { SUPABASE_URL, SUPABASE_SECRET_KEY } = env();
  return createSupabaseClient(SUPABASE_URL, SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
