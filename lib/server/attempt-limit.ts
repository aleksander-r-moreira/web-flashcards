import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "./supabase";

const RULES = {
  login: { windowSec: 15 * 60, max: 10 },
  signup: { windowSec: 60 * 60, max: 3 },
  reset: { windowSec: 60 * 60, max: 3 },
} as const;

export type AttemptKind = keyof typeof RULES;

function hashEmail(email: string) {
  return createHash("sha256").update(email.trim().toLowerCase()).digest("hex").slice(0, 40);
}

export async function takeAttempt(kind: AttemptKind, email: string): Promise<number> {
  const rule = RULES[kind];
  const { data, error } = await createAdminClient().rpc("take_rate_token", {
    p_key: `${kind}:${hashEmail(email)}`,
    p_window_seconds: rule.windowSec,
    p_max: rule.max,
  });
  if (error) {
    console.error("Erro no limite de tentativas:", error.message);
    return 60;
  }
  return Number(data) || 0;
}
