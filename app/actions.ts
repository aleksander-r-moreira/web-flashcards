"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/server/auth";
import { toCard } from "@/lib/server/data";
import { createClient } from "@/lib/server/supabase";
import { schedule, type Grade } from "@/lib/srs";

const Uuid = z.uuid();
const GradeSchema = z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]);

export async function gradeCardAction(cardId: unknown, grade: unknown): Promise<{ due: number } | { error: string }> {
  const id = Uuid.safeParse(cardId);
  const g = GradeSchema.safeParse(grade);
  if (!id.success || !g.success) return { error: "Dados inválidos." };

  const user = await requireUser();
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("cards")
    .select("id, deck_id, question, answer, ease, interval_days, repetitions, lapses, due, last_reviewed")
    .eq("id", id.data)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !row) return { error: "Cartão não encontrado." };

  const next = schedule(toCard(row), g.data as Grade);
  const { error: updateError } = await supabase
    .from("cards")
    .update({
      ease: next.ease,
      interval_days: next.interval,
      repetitions: next.repetitions,
      lapses: next.lapses,
      due: new Date(next.due).toISOString(),
      last_reviewed: new Date(next.lastReviewed ?? Date.now()).toISOString(),
    })
    .eq("id", id.data)
    .eq("user_id", user.id);
  if (updateError) {
    console.error("Erro ao salvar revisão:", updateError.message);
    return { error: "Não foi possível salvar a revisão." };
  }
  return { due: next.due };
}

export async function deleteDeckAction(deckId: unknown): Promise<{ ok: boolean }> {
  const id = Uuid.safeParse(deckId);
  if (!id.success) return { ok: false };
  const user = await requireUser();
  const supabase = await createClient();
  const { error } = await supabase.from("decks").delete().eq("id", id.data).eq("user_id", user.id);
  if (error) {
    console.error("Erro ao excluir material:", error.message);
    return { ok: false };
  }
  revalidatePath("/");
  redirect("/");
}
