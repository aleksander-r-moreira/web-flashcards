import "server-only";
import type { Card } from "@/lib/srs";
import type { CurrentUser } from "./auth";
import { createClient } from "./supabase";

export type DeckSummary = {
  id: string;
  title: string;
  cardCount: number;
  dueCount: number;
  learnedCount: number;
  nextDue: number | null;
};

export type DeckDetail = {
  id: string;
  title: string;
  sourceType: "text" | "url" | "video";
  sourceUrl: string | null;
  keyPoints: string[];
  cards: Card[];
};

type CardRow = {
  id: string;
  deck_id: string;
  question: string;
  answer: string;
  ease: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
  due: string;
  last_reviewed: string | null;
};

const CARD_COLUMNS = "id, deck_id, question, answer, ease, interval_days, repetitions, lapses, due, last_reviewed";

export function toCard(row: CardRow): Card & { deckId: string } {
  return {
    id: row.id,
    deckId: row.deck_id,
    question: row.question,
    answer: row.answer,
    ease: row.ease,
    interval: row.interval_days,
    repetitions: row.repetitions,
    lapses: row.lapses,
    due: Date.parse(row.due),
    lastReviewed: row.last_reviewed ? Date.parse(row.last_reviewed) : undefined,
  };
}

export function requestTime() {
  return Date.now();
}

function fail(what: string, error: { message: string }): never {
  console.error(`Erro ao ${what}:`, error.message);
  throw new Error(`Não foi possível ${what}.`);
}

export async function listDecks(user: CurrentUser): Promise<DeckSummary[]> {
  const supabase = await createClient();
  const [decks, cards] = await Promise.all([
    supabase.from("decks").select("id, title").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("cards").select("deck_id, due, repetitions").eq("user_id", user.id),
  ]);
  if (decks.error) fail("carregar os materiais", decks.error);
  if (cards.error) fail("carregar os cartões", cards.error);

  const now = Date.now();
  return decks.data.map((d) => {
    const mine = cards.data.filter((c) => c.deck_id === d.id);
    const dues = mine.map((c) => Date.parse(c.due));
    return {
      id: d.id,
      title: d.title,
      cardCount: mine.length,
      dueCount: dues.filter((t) => t <= now).length,
      learnedCount: mine.filter((c) => c.repetitions >= 2).length,
      nextDue: dues.length ? Math.min(...dues) : null,
    };
  });
}

export async function getDeck(user: CurrentUser, deckId: string): Promise<DeckDetail | null> {
  const supabase = await createClient();
  const { data: deck, error } = await supabase
    .from("decks")
    .select("id, title, source_type, source_url, key_points")
    .eq("id", deckId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) fail("carregar o material", error);
  if (!deck) return null;

  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select(CARD_COLUMNS)
    .eq("deck_id", deckId)
    .eq("user_id", user.id)
    .order("due");
  if (cardsError) fail("carregar os cartões", cardsError);

  return {
    id: deck.id,
    title: deck.title,
    sourceType: deck.source_type,
    sourceUrl: deck.source_url,
    keyPoints: deck.key_points,
    cards: (cards as CardRow[]).map(toCard),
  };
}

export async function getReviewCards(user: CurrentUser, deckId: string | "all") {
  const supabase = await createClient();
  let query = supabase.from("cards").select(`${CARD_COLUMNS}, decks(title)`).eq("user_id", user.id).order("due");
  if (deckId !== "all") query = query.eq("deck_id", deckId);
  const { data, error } = await query.limit(500);
  if (error) fail("carregar a revisão", error);
  return (data as unknown as (CardRow & { decks: { title: string } | null })[]).map((row) => ({
    ...toCard(row),
    deckTitle: row.decks?.title ?? "",
  }));
}

export async function getDueSummary(user: CurrentUser) {
  const supabase = await createClient();
  const nowIso = new Date().toISOString();
  const [due, next] = await Promise.all([
    supabase.from("cards").select("id", { count: "exact", head: true }).eq("user_id", user.id).lte("due", nowIso),
    supabase.from("cards").select("due").eq("user_id", user.id).gt("due", nowIso).order("due").limit(1).maybeSingle(),
  ]);
  if (due.error) fail("contar revisões", due.error);
  if (next.error) fail("contar revisões", next.error);
  return { dueCount: due.count ?? 0, nextDue: next.data ? Date.parse(next.data.due) : null };
}
