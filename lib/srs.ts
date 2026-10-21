export type Card = {
  id: string;
  question: string;
  answer: string;
  ease: number;
  interval: number;
  repetitions: number;
  lapses: number;
  due: number;
  lastReviewed?: number;
};

export type Grade = 0 | 1 | 2 | 3;

export const GRADES: { grade: Grade; label: string; key: string }[] = [
  { grade: 0, label: "Errei", key: "1" },
  { grade: 1, label: "Difícil", key: "2" },
  { grade: 2, label: "Bom", key: "3" },
  { grade: 3, label: "Fácil", key: "4" },
];

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const MIN_EASE = 1.3;
const RELEARN_DELAY = 10 * MINUTE;

const QUALITY: Record<Grade, number> = { 0: 1, 1: 3, 2: 4, 3: 5 };

export function newCard(id: string, question: string, answer: string, now = Date.now()): Card {
  return { id, question, answer, ease: 2.5, interval: 0, repetitions: 0, lapses: 0, due: now };
}

function clampEase(value: number) {
  return Math.min(10, Math.max(MIN_EASE, Math.round(value * 100) / 100));
}

export function schedule(card: Card, grade: Grade, now = Date.now()): Card {
  if (grade === 0) {
    return {
      ...card,
      repetitions: 0,
      interval: 0,
      lapses: card.lapses + 1,
      ease: clampEase(card.ease - 0.2),
      due: now + RELEARN_DELAY,
      lastReviewed: now,
    };
  }

  const q = QUALITY[grade];
  const ease = clampEase(card.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));

  let interval: number;
  if (card.repetitions === 0) {
    interval = grade === 3 ? 4 : 1;
  } else if (card.repetitions === 1) {
    interval = grade === 1 ? 3 : grade === 3 ? 8 : 6;
  } else {
    const bonus = grade === 1 ? 0.8 : grade === 3 ? 1.3 : 1;
    interval = Math.max(card.interval + 1, Math.round(card.interval * ease * bonus));
  }

  return {
    ...card,
    ease,
    interval,
    repetitions: card.repetitions + 1,
    due: now + interval * DAY,
    lastReviewed: now,
  };
}

export function isDue(card: Card, now = Date.now()) {
  return card.due <= now;
}

export function formatInterval(ms: number) {
  if (ms < 60 * MINUTE) return `${Math.max(1, Math.round(ms / MINUTE))} min`;
  if (ms < DAY) return `${Math.round(ms / (60 * MINUTE))} h`;
  const days = Math.round(ms / DAY);
  if (days < 30) return `${days} d`;
  if (days < 365) return `${Math.round(days / 30)} mês`;
  return `${(days / 365).toFixed(1)} a`;
}

export function formatDue(due: number, now = Date.now()) {
  return due <= now ? "agora" : `em ${formatInterval(due - now)}`;
}
