import "server-only";
import { createHmac } from "node:crypto";
import { env } from "./env";
import { createAdminClient } from "./supabase";

const WINDOW_SEC = 10 * 60;
const MAX_FETCHES = Number(process.env.FETCH_LIMIT_PER_10MIN) || 15;

export async function takeFetchToken(owner: string): Promise<{ ok: true } | { ok: false; message: string; retryAfterSec: number }> {
  const digest = createHmac("sha256", env().SUPABASE_SECRET_KEY).update(`fetch:${owner}`).digest("hex");
  const { data, error } = await createAdminClient().rpc("take_rate_token", {
    p_key: `fetch:${digest.slice(0, 40)}`,
    p_window_seconds: WINDOW_SEC,
    p_max: MAX_FETCHES,
  });
  if (error) {
    console.error("Erro no limite de links:", error.message);
    return { ok: false, message: "Serviço temporariamente indisponível.", retryAfterSec: 60 };
  }
  const wait = Number(data) || 0;
  if (wait > 0) return { ok: false, message: `Muitos links seguidos. Tente de novo em ${Math.ceil(wait / 60)} min.`, retryAfterSec: wait };
  return { ok: true };
}
