import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { getDeck, requestTime } from "@/lib/server/data";
import { formatDue, isDue } from "@/lib/srs";
import { isSafeHttpUrl } from "@/lib/url";
import { DeckTabs } from "@/app/components/deck-tabs";
import { DeleteDeckButton } from "@/app/components/delete-deck-button";

export default function DeckPage({ params }: PageProps<"/deck/[id]">) {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Carregando…</p>}>
      <DeckContent params={params} />
    </Suspense>
  );
}

async function DeckContent({ params }: { params: PageProps<"/deck/[id]">["params"] }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const user = await requireUser();
  const deck = await getDeck(user, id);
  if (!deck) notFound();

  const now = requestTime();
  const due = deck.cards.filter((c) => isDue(c, now)).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <Link href="/" className="text-sm text-neutral-500 hover:underline">
            ← Materiais
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{deck.title}</h1>
          {deck.sourceUrl && isSafeHttpUrl(deck.sourceUrl) && (
            <a
              href={deck.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block truncate text-sm text-indigo-600 hover:underline dark:text-indigo-400"
            >
              {deck.sourceType === "video" ? "🎬 Assistir o vídeo no YouTube" : deck.sourceUrl}
            </a>
          )}
        </div>
        <div className="flex gap-2">
          <Link href={`/review/${deck.id}`} className="btn-primary">
            {due > 0 ? `Revisar (${due})` : "Estudar mesmo assim"}
          </Link>
          <DeleteDeckButton deckId={deck.id} />
        </div>
      </div>

      <DeckTabs
        cardCount={deck.cards.length}
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
            {deck.cards.map((c) => (
              <li key={c.id} className="card space-y-2">
                <p className="font-medium">{c.question}</p>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">{c.answer}</p>
                <p className="text-xs text-neutral-500">
                  Próxima revisão {formatDue(c.due, now)}
                  {c.repetitions > 0 && ` · ${c.repetitions} acerto(s) seguidos`}
                  {c.lapses > 0 && ` · esquecido ${c.lapses}x`}
                </p>
              </li>
            ))}
          </ul>
        }
      />
    </div>
  );
}
