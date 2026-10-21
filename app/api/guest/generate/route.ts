import { GenerateRequestSchema, LIMITS } from "@/lib/schemas";
import { generateDeck, GenerationError } from "@/lib/server/ai";
import { takeFetchToken } from "@/lib/server/fetch-limit";
import { clientIp, releaseGuest, reserveGuest } from "@/lib/server/guest-limit";
import { htmlToText } from "@/lib/server/html-to-text";
import { assertSameOrigin, GuardError, readJson } from "@/lib/server/request-guard";
import { FetchError, safeFetchPage } from "@/lib/server/safe-fetch";
import { isUnsupportedVideoUrl, parseYouTubeUrl } from "@/lib/youtube";

const MAX_BODY_BYTES = 300_000;

export const maxDuration = 120;

function reply(body: object, status = 200, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...extra } });
}

export async function POST(request: Request) {
  let input;
  try {
    assertSameOrigin(request);
    const parsed = GenerateRequestSchema.safeParse(await readJson(request, MAX_BODY_BYTES));
    if (!parsed.success) return reply({ error: parsed.error.issues[0]?.message ?? "Dados inválidos." }, 400);
    input = parsed.data;
  } catch (e) {
    if (e instanceof GuardError) return reply({ error: e.message }, e.status);
    console.error("Erro na portaria de /api/guest/generate:", e);
    return reply({ error: "Erro inesperado. Tente novamente." }, 500);
  }

  if (input.kind === "url" && (parseYouTubeUrl(input.url) || isUnsupportedVideoUrl(input.url))) {
    return reply({ error: "Vídeos só para quem tem conta. Entre para usar." }, 403);
  }

  if (input.kind === "url") {
    const fetchToken = await takeFetchToken(`ip:${clientIp(request)}`);
    if (!fetchToken.ok) return reply({ error: fetchToken.message }, 429, { "Retry-After": String(fetchToken.retryAfterSec) });
  }

  const reservation = await reserveGuest(request);
  if (!reservation.ok) {
    const extra: Record<string, string> = reservation.retryAfterSec ? { "Retry-After": String(reservation.retryAfterSec) } : {};
    return reply({ error: reservation.message }, reservation.status, extra);
  }

  try {
    let text: string;
    if (input.kind === "text") {
      text = input.text;
    } else {
      const page = await safeFetchPage(input.url);
      text = page.isHtml ? htmlToText(page.text) : page.text.trim();
      if (text.length < LIMITS.textMin) {
        await releaseGuest(reservation.keys);
        return reply({ error: "Não encontramos texto suficiente nessa página. Tente colar o conteúdo." }, 422);
      }
      if (text.length > LIMITS.textMax) {
        await releaseGuest(reservation.keys);
        return reply({ error: "A página é longa demais. Copie e cole só a parte que quer estudar." }, 413);
      }
    }

    const deck = await generateDeck({ kind: "text", text });
    return reply(deck);
  } catch (e) {
    if (e instanceof FetchError) {
      await releaseGuest(reservation.keys);
      return reply({ error: e.message }, 400);
    }
    if (e instanceof GenerationError) {
      if (e.status >= 500) await releaseGuest(reservation.keys);
      return reply({ error: e.message }, e.status);
    }
    await releaseGuest(reservation.keys);
    console.error("Erro inesperado em /api/guest/generate:", e);
    return reply({ error: "Erro inesperado. Tente novamente." }, 500);
  }
}
