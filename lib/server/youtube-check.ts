import "server-only";
import { z } from "zod";
import type { YouTubeVideo } from "@/lib/youtube";
import { FetchError, safeFetchJson } from "./safe-fetch";

const OEmbedSchema = z.object({ title: z.string().max(300).optional() });

export type VideoCheck = { ok: true; title?: string } | { ok: false; message: string };

export async function checkYouTubeVideo(video: YouTubeVideo): Promise<VideoCheck> {
  const endpoint = `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(video.url)}`;
  try {
    const parsed = OEmbedSchema.safeParse(await safeFetchJson(endpoint));
    return { ok: true, title: parsed.success ? parsed.data.title : undefined };
  } catch (e) {
    if (e instanceof FetchError && (e.httpStatus === 404 || e.httpStatus === 400)) {
      return { ok: false, message: "Vídeo não encontrado no YouTube. Confira o link." };
    }
    return { ok: true };
  }
}
