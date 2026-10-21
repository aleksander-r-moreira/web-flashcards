"use client";

import { useState, type ReactNode } from "react";

export function DeckTabs({ cardCount, summary, cards }: { cardCount: number; summary: ReactNode; cards: ReactNode }) {
  const [tab, setTab] = useState<"summary" | "cards">("summary");
  return (
    <>
      <div role="tablist" className="flex gap-4 border-b border-black/10 text-sm dark:border-white/10">
        {(["summary", "cards"] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 pb-2 ${tab === t ? "border-indigo-600 font-medium" : "border-transparent text-neutral-500"}`}
          >
            {t === "summary" ? "Resumo" : `Flashcards (${cardCount})`}
          </button>
        ))}
      </div>
      {tab === "summary" ? summary : cards}
    </>
  );
}
