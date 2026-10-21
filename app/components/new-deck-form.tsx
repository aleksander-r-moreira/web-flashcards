"use client";

import { useRouter } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { z } from "zod";
import { LIMITS } from "@/lib/schemas";
import { isUnsupportedVideoUrl, parseYouTubeUrl, VIDEO_MAX_MINUTES } from "@/lib/youtube";

const ResponseSchema = z.object({ id: z.uuid() });

export function NewDeckForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"text" | "url">("text");
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitted = useRef(false);

  useLayoutEffect(
    () => () => {
      setLoading(false);
      setError(null);
      if (submitted.current) {
        submitted.current = false;
        setValue("");
      }
    },
    [],
  );

  const isVideo = mode === "url" && parseYouTubeUrl(value) !== null;
  const otherVideo = mode === "url" && !isVideo && isUnsupportedVideoUrl(value);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "url" ? { kind: "url", url: value.trim() } : { kind: "text", text: value }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (res.status === 401) {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/login");
        return;
      }
      if (!res.ok) {
        const message = (data as { error?: unknown }).error;
        throw new Error(typeof message === "string" ? message : "Falha ao gerar o material.");
      }
      const { id } = ResponseSchema.parse(data);
      submitted.current = true;
      setValue("");
      setLoading(false);
      router.push(`/deck/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao gerar o material.");
      setLoading(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-black/10 bg-transparent p-3 text-sm outline-none focus:border-indigo-500 dark:border-white/15";

  return (
    <form onSubmit={submit} className="card space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-lg font-semibold">Novo material</h2>
        <div className="flex rounded-lg border border-black/10 p-0.5 text-sm dark:border-white/15">
          {(["text", "url"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`rounded-md px-3 py-1 ${mode === m ? "bg-indigo-600 text-white" : ""}`}
            >
              {m === "text" ? "Colar texto" : "Link ou vídeo"}
            </button>
          ))}
        </div>
      </div>

      {mode === "text" ? (
        <textarea
          value={value}
          onChange={(e) => {
            e.currentTarget.setCustomValidity("");
            setValue(e.target.value);
          }}
          onInvalid={(e) => e.currentTarget.setCustomValidity(`No mínimo ${LIMITS.textMin} caracteres.`)}
          placeholder="Cole aqui o texto da aula, apostila ou artigo…"
          rows={8}
          required
          minLength={LIMITS.textMin}
          maxLength={LIMITS.textMax}
          aria-label="Texto do material"
          className={inputClass}
        />
      ) : (
        <input
          type="url"
          value={value}
          onChange={(e) => {
            e.currentTarget.setCustomValidity("");
            setValue(e.target.value);
          }}
          onInvalid={(e) => e.currentTarget.setCustomValidity(e.currentTarget.value ? "Link inválido." : "Cole um link.")}
          placeholder="Link de uma página ou de um vídeo do YouTube"
          required
          maxLength={LIMITS.urlMax}
          aria-label="Link do material"
          className={inputClass}
        />
      )}
      {isVideo && (
        <p className="text-sm text-indigo-700 dark:text-indigo-300">
          🎬 Vídeo do YouTube reconhecido: a IA vai assistir até os primeiros {VIDEO_MAX_MINUTES} minutos (fala e tela). O
          vídeo precisa ser público. Limite: 3 vídeos por dia.
        </p>
      )}
      {otherVideo && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Só conseguimos assistir vídeos do YouTube. Para vídeos de outros sites, cole a transcrição em &quot;Colar texto&quot;.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-neutral-500">
          A IA gera um resumo em pontos-chave e flashcards; as revisões são agendadas pela curva de esquecimento.
          {mode === "text" && ` ${value.length.toLocaleString("pt-BR")}/${LIMITS.textMax.toLocaleString("pt-BR")} caracteres.`}
        </p>
        <button type="submit" disabled={loading || !value.trim() || otherVideo} className="btn-primary shrink-0">
          {loading ? (isVideo ? "Assistindo o vídeo… (1–3 min)" : "Gerando… (~20 s)") : "Gerar flashcards"}
        </button>
      </div>
    </form>
  );
}
