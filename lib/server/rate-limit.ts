import "server-only";
import { createAdminClient } from "./supabase";

const LIMITS = {
  per10min: Number(process.env.RATE_LIMIT_PER_10MIN) || 5,
  perDay: Number(process.env.RATE_LIMIT_PER_DAY) || 20,
  globalPerDay: Number(process.env.RATE_LIMIT_GLOBAL_PER_DAY) || 300,
  videoPerDay: Number(process.env.RATE_LIMIT_VIDEO_PER_DAY) || 3,
  videoGlobalPerDay: Number(process.env.RATE_LIMIT_VIDEO_GLOBAL_PER_DAY) || 8,
};

const MESSAGES: Record<string, (retryMin: number) => string> = {
  short: (m) => `Muitas gerações seguidas. Tente de novo em ${m} min.`,
  daily: () => "Você atingiu o limite de gerações de hoje. Suas revisões continuam funcionando.",
  global: () => "O limite diário do app foi atingido. Volte amanhã — suas revisões continuam funcionando.",
  video_daily: () => `Você atingiu o limite de ${LIMITS.videoPerDay} vídeos por dia. Textos e links de páginas continuam liberados.`,
  video_global: () => "O limite diário de vídeos do app foi atingido. Tente amanhã — textos e páginas continuam liberados.",
};

export type GenerationKind = "text" | "video";
export type Reservation = { ok: true; id: number } | { ok: false; retryAfterSec: number; message: string };

export async function reserveGeneration(userId: string, kind: GenerationKind): Promise<Reservation> {
  const { data, error } = await createAdminClient()
    .rpc("consume_generation", {
      p_user: userId,
      p_kind: kind,
      p_per_10min: LIMITS.per10min,
      p_per_day: LIMITS.perDay,
      p_global_per_day: LIMITS.globalPerDay,
      p_video_per_day: LIMITS.videoPerDay,
      p_video_global_per_day: LIMITS.videoGlobalPerDay,
    })
    .single<{ generation_id: number | null; reason: string; retry_after_sec: number }>();
  if (error) {
    console.error("Erro no rate limit:", error.message);
    throw new Error("rate-limit indisponível");
  }
  if (data.reason === "ok" && data.generation_id !== null) return { ok: true, id: data.generation_id };
  const message = (MESSAGES[data.reason] ?? MESSAGES.global)(Math.ceil(data.retry_after_sec / 60));
  return { ok: false, retryAfterSec: data.retry_after_sec, message };
}

export async function refundGeneration(id: number) {
  const { error } = await createAdminClient().rpc("refund_generation", { p_id: id });
  if (error) console.error("Erro ao devolver geração:", error.message);
}
