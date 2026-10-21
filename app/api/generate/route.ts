import { GenerateRequestSchema, LIMITS } from "@/lib/schemas";
import { generateDeck, GenerationError, type Material } from "@/lib/server/ai";
import { getCurrentUser } from "@/lib/server/auth";
import { takeFetchToken } from "@/lib/server/fetch-limit";
import { htmlToText } from "@/lib/server/html-to-text";
import { refundGeneration, reserveGeneration } from "@/lib/server/rate-limit";
import { assertSameOrigin, GuardError, readJson } from "@/lib/server/request-guard";
import { FetchError, safeFetchPage } from "@/lib/server/safe-fetch";
import { createAdminClient } from "@/lib/server/supabase";
import { checkYouTubeVideo } from "@/lib/server/youtube-check";
import { isUnsupportedVideoUrl, parseYouTubeUrl, VIDEO_MAX_MINUTES } from "@/lib/youtube";

const MAX_BODY_BYTES = 300_000;

export const maxDuration = 300;

function reply(body: object, status = 200, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...extra } });
}

export async function POST(request: Request) {
  let input;
  let userId: string;
  try {
    assertSameOrigin(request);
    const user = await getCurrentUser();
    if (!user) return reply({ error: "Sua sessão expirou. Entre novamente." }, 401);
    userId = user.id;
    const parsed = GenerateRequestSchema.safeParse(await readJson(request, MAX_BODY_BYTES));
    if (!parsed.success) return reply({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, 400);
    input = parsed.data;
  } catch (e) {
    if (e instanceof GuardError) return reply({ error: e.message }, e.status);
    console.error("Erro na portaria de /api/generate:", e);
    return reply({ error: "Erro inesperado. Tente novamente." }, 500);
  }

  const video = input.kind === "url" ? parseYouTubeUrl(input.url) : null;
  if (input.kind === "url" && !video && isUnsupportedVideoUrl(input.url)) {
    return reply({ error: "Só conseguimos assistir vídeos do YouTube. Para outros vídeos, cole a transcrição como texto." }, 400);
  }

  if (input.kind === "url") {
    const fetchToken = await takeFetchToken(`user:${userId}`);
    if (!fetchToken.ok) return reply({ error: fetchToken.message }, 429, { "Retry-After": String(fetchToken.retryAfterSec) });
  }

  let reservation;
  try {
    reservation = await reserveGeneration(userId, video ? "video" : "text");
  } catch {
    return reply({ error: "Serviço temporariamente indisponível." }, 503);
  }
  if (!reservation.ok) {
    return reply({ error: reservation.message }, 429, { "Retry-After": String(reservation.retryAfterSec) });
  }

  try {
    let material: Material;
    if (video) {
      const check = await checkYouTubeVideo(video);
      if (!check.ok) {
        await refundGeneration(reservation.id);
        return reply({ error: check.message }, 404);
      }
      material = { kind: "video", url: video.url, maxMinutes: VIDEO_MAX_MINUTES };
    } else if (input.kind === "text") {
      material = { kind: "text", text: input.text };
    } else {
      const page = await safeFetchPage(input.url);
      const text = page.isHtml ? htmlToText(page.text) : page.text.trim();
      if (text.length < LIMITS.textMin) {
        await refundGeneration(reservation.id);
        return reply({ error: "Não encontramos texto suficiente nessa página. Tente colar o conteúdo." }, 422);
      }
      if (text.length > LIMITS.textMax) {
        await refundGeneration(reservation.id);
        return reply({ error: "A página é longa demais. Copie e cole só a parte que quer estudar." }, 413);
      }
      material = { kind: "text", text };
    }

    const deck = await generateDeck(material);

    const { data: deckId, error } = await createAdminClient().rpc("create_deck", {
      p_user: userId,
      p_title: deck.title,
      p_source_type: video ? "video" : input.kind,
      p_source_url: video ? video.url : input.kind === "url" ? input.url : null,
      p_key_points: deck.keyPoints,
      p_cards: deck.flashcards,
    });
    if (error || typeof deckId !== "string") {
      console.error("Erro ao salvar material:", error?.message);
      await refundGeneration(reservation.id);
      return reply({ error: "Não foi possível salvar o material. Tente novamente." }, 500);
    }
    return reply({ id: deckId });
  } catch (e) {
    if (e instanceof FetchError) {
      await refundGeneration(reservation.id);
      return reply({ error: e.message }, 400);
    }
    if (e instanceof GenerationError) {
      if (e.status >= 500) await refundGeneration(reservation.id);
      return reply({ error: e.message }, e.status);
    }
    await refundGeneration(reservation.id);
    console.error("Erro inesperado em /api/generate:", e);
    return reply({ error: "Erro inesperado. Tente novamente." }, 500);
  }
}
