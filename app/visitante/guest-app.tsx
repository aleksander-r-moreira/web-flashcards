"use client";

import Link from "next/link";
import { useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { DeckTabs } from "@/app/components/deck-tabs";
import { ReviewSession } from "@/app/components/review-session";
import { GeneratedDeckSchema, LIMITS, type GeneratedDeck } from "@/lib/schemas";
import { newCard } from "@/lib/srs";
import { isUnsupportedVideoUrl, parseYouTubeUrl } from "@/lib/youtube";

const STORAGE_KEY = "estudos:visitante";
const CHANGE_EVENT = "estudos-visitante";

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE_EVENT, callback);
  return () => window.removeEventListener(CHANGE_EVENT, callback);
}

function readStored(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStored(value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(STORAGE_KEY);
    else sessionStorage.setItem(STORAGE_KEY, value);
  } catch {}
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function parseDeck(raw: string | null): GeneratedDeck | null {
  if (!raw) return null;
  try {
    const result = GeneratedDeckSchema.safeParse(JSON.parse(raw));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

export function GuestApp() {
  const raw = useSyncExternalStore(subscribe, readStored, () => null);
  const deck = useMemo(() => parseDeck(raw), [raw]);

  return (
    <div className="space-y-6">
      <GuestBanner />
      {deck ? <GuestDeck deck={deck} /> : <GuestForm />}
    </div>
  );
}

function GuestBanner() {
  return (
    <div className="card flex flex-wrap items-center justify-between gap-3 border-amber-400/60 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10">
      <div className="text-sm">
        <p className="font-medium">Modo visitante: 1 material por dia, sem salvar.</p>
        <p className="text-neutral-600 dark:text-neutral-400">Entre para usar o app completo.</p>
      </div>
      <Link href="/login" className="btn-primary">
        Entrar
      </Link>
    </div>
  );
}

function GuestDeck({ deck }: { deck: GeneratedDeck }) {
  const [round, setRound] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const cards = useMemo(
    () => deck.flashcards.map((f, i) => ({ ...newCard(`visitante-${i}`, f.question, f.answer, 0), deckTitle: deck.title })),
    [deck],
  );

  if (reviewing) {
    return <ReviewSession key={round} initialCards={cards} cram onExit={() => setReviewing(false)} />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="min-w-0 text-2xl font-semibold tracking-tight">{deck.title}</h1>
        <div className="flex gap-2">
          <button
            className="btn-primary"
            onClick={() => {
              setRound((n) => n + 1);
              setReviewing(true);
            }}
          >
            Revisar ({cards.length})
          </button>
          <button className="btn-ghost" onClick={() => writeStored(null)}>
            Descartar
          </button>
        </div>
      </div>
      <DeckTabs
        cardCount={deck.flashcards.length}
        summary={
          <ol className="card list-decimal space-y-3 pl-10 marker:text-indigo-600">
            {deck.keyPoints.map((p, i) => (
              <li key={i} className="pl-1 leading-relaxed">
                {p}
              </li>
            ))}
          </ol>
        }
        cards={
          <ul className="space-y-3">
            {deck.flashcards.map((c, i) => (
              <li key={i} className="card space-y-2">
                <p className="font-medium">{c.question}</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{c.answer}</p>
              </li>
            ))}
          </ul>
        }
      />
    </div>
  );
}

function GuestForm() {
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

  const isVideo = mode === "url" && (parseYouTubeUrl(value) !== null || isUnsupportedVideoUrl(value));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/guest/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "url" ? { kind: "url", url: value.trim() } : { kind: "text", text: value }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = (data as { error?: unknown }).error;
        throw new Error(typeof message === "string" ? message : "Falha ao gerar o material.");
      }
      const deck = GeneratedDeckSchema.parse(data);
      submitted.current = true;
      setValue("");
      setLoading(false);
      writeStored(JSON.stringify(deck));
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
        <h1 className="text-lg font-semibold">Testar sem conta</h1>
        <div className="flex rounded-lg border border-black/10 p-0.5 text-sm dark:border-white/15">
          {(["text", "url"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={`rounded-md px-3 py-1 ${mode === m ? "bg-indigo-600 text-white" : ""}`}
            >
              {m === "text" ? "Colar texto" : "Link"}
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
          placeholder="Link de uma página"
          required
          maxLength={LIMITS.urlMax}
          aria-label="Link do material"
          className={inputClass}
        />
      )}

      {isVideo && <p className="text-sm text-amber-700 dark:text-amber-400">Vídeos só para quem tem conta.</p>}

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-neutral-500">
          O material fica só nesta aba e some ao fechá-la.
          {mode === "text" && ` ${value.length.toLocaleString("pt-BR")}/${LIMITS.textMax.toLocaleString("pt-BR")} caracteres.`}
        </p>
        <button type="submit" disabled={loading || !value.trim() || isVideo} className="btn-primary shrink-0">
          {loading ? "Gerando… (~20 s)" : "Gerar flashcards"}
        </button>
      </div>
    </form>
  );
}
