"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { gradeCardAction } from "@/app/actions";
import { GRADES, formatInterval, schedule, type Card, type Grade } from "@/lib/srs";

type ReviewCard = Card & { deckTitle: string };

const GRADE_COLORS = [
  "bg-red-600 hover:bg-red-500",
  "bg-amber-600 hover:bg-amber-500",
  "bg-green-600 hover:bg-green-500",
  "bg-sky-600 hover:bg-sky-500",
];

function SaveWarning({ count }: { count: number }) {
  return (
    <p role="alert" className="text-center text-sm text-red-600 dark:text-red-400">
      {count === 1 ? "1 resposta não foi salva." : `${count} respostas não foram salvas.`} Esses cartões voltam na próxima revisão.
    </p>
  );
}

export function ReviewSession({
  initialCards,
  cram,
  onExit,
}: {
  initialCards: ReviewCard[];
  cram: boolean;
  onExit?: () => void;
}) {
  const [queue, setQueue] = useState(initialCards);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const [failedSaves, setFailedSaves] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const card = queue[0];

  function answer(grade: Grade) {
    if (!card) return;
    if (!cram) {
      gradeCardAction(card.id, grade)
        .then((r) => {
          if ("error" in r) setFailedSaves((n) => n + 1);
        })
        .catch(() => setFailedSaves((n) => n + 1));
    }
    const rest = queue.slice(1);
    setQueue(grade === 0 ? [...rest, card] : rest);
    setRevealed(false);
    setReviewed((n) => n + 1);
  }

  function reveal() {
    setNow(Date.now());
    setRevealed(true);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!card) return;
      if (!revealed && (e.key === " " || e.key === "Enter")) {
        e.preventDefault();
        reveal();
      } else if (revealed) {
        const g = GRADES.find((g) => g.key === e.key);
        if (g) answer(g.grade);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!card) {
    return (
      <div className="card space-y-4 text-center">
        <p className="text-4xl">🎉</p>
        <h1 className="text-xl font-semibold">{reviewed > 0 ? "Sessão concluída!" : "Nada para revisar agora"}</h1>
        <p className="text-sm text-neutral-500">
          {reviewed > 0
            ? `Você revisou ${reviewed} ${reviewed === 1 ? "cartão" : "cartões"}.${cram ? "" : " As próximas revisões foram agendadas."}`
            : "Volte quando os próximos cartões vencerem."}
        </p>
        {failedSaves > 0 && <SaveWarning count={failedSaves} />}
        {onExit ? (
          <button className="btn-primary" onClick={onExit}>
            Voltar
          </button>
        ) : (
          <Link href="/" className="btn-primary">
            Voltar ao início
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {onExit && (
        <button className="text-sm text-neutral-500 hover:underline" onClick={onExit}>
          ← Voltar
        </button>
      )}
      <div className="flex items-center justify-between text-sm text-neutral-500">
        <span className="truncate">{card.deckTitle}</span>
        <span className="shrink-0">
          {cram && "Estudo livre · "}
          {queue.length} restante{queue.length === 1 ? "" : "s"}
        </span>
      </div>

      <div key={`${card.id}-${reviewed}`} className="flip-card">
        <div
          className={`flip-card-inner ${revealed ? "" : "cursor-pointer"}`}
          data-flipped={revealed}
          onClick={revealed ? undefined : reveal}
        >
          <div className="flip-card-face card flex min-h-72 flex-col justify-center gap-4 text-center" aria-hidden={revealed}>
            <p className="text-lg font-medium leading-relaxed">{card.question}</p>
            <p className="text-xs text-neutral-500">Toque para virar</p>
          </div>
          <div
            className="flip-card-face flip-card-back card flex min-h-72 flex-col justify-center gap-4 text-center"
            aria-hidden={!revealed}
            aria-live="polite"
          >
            <p className="text-sm text-neutral-500">{card.question}</p>
            <hr className="border-black/10 dark:border-white/10" />
            <p className="text-lg font-medium leading-relaxed">{card.answer}</p>
          </div>
        </div>
      </div>

      {!revealed ? (
        <button className="btn-primary w-full py-3" onClick={reveal}>
          Mostrar resposta <kbd className="text-xs opacity-70">espaço</kbd>
        </button>
      ) : (
        <div className="grid grid-cols-4 gap-2">
          {GRADES.map(({ grade, label, key }) => (
            <button key={grade} onClick={() => answer(grade)} className={`btn flex-col gap-0.5 py-3 text-white ${GRADE_COLORS[grade]}`}>
              <span>{label}</span>
              <span className="text-xs opacity-80">{cram ? `tecla ${key}` : formatInterval(schedule(card, grade, now).due - now)}</span>
            </button>
          ))}
        </div>
      )}
      {failedSaves > 0 && <SaveWarning count={failedSaves} />}
      {cram && (
        <p className="text-center text-xs text-neutral-500">
          Estudo livre: suas respostas não alteram o agendamento.
        </p>
      )}
    </div>
  );
}
