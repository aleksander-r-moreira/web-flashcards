import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";
import { ReviewSession } from "@/app/components/review-session";
import { requireUser } from "@/lib/server/auth";
import { getReviewCards, requestTime } from "@/lib/server/data";

export default function ReviewPage({ params }: PageProps<"/review/[deckId]">) {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Preparando a revisão…</p>}>
      <ReviewContent params={params} />
    </Suspense>
  );
}

async function ReviewContent({ params }: { params: PageProps<"/review/[deckId]">["params"] }) {
  const { deckId } = await params;
  if (deckId !== "all" && !z.uuid().safeParse(deckId).success) notFound();
  const user = await requireUser();
  const cards = await getReviewCards(user, deckId);

  const now = requestTime();
  const due = cards.filter((c) => c.due <= now);
  const cram = due.length === 0 && deckId !== "all";
  return <ReviewSession initialCards={cram ? cards : due} cram={cram} />;
}
