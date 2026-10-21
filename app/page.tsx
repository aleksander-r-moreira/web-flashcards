import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/server/auth";
import { listDecks, requestTime } from "@/lib/server/data";
import { formatDue } from "@/lib/srs";
import { NewDeckForm } from "./components/new-deck-form";
import { NotificationToggle } from "./components/notification-toggle";

export default function HomePage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Carregando seus estudos…</p>}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  const user = await requireUser();
  const decks = await listDecks(user);
  const now = requestTime();
  const totalDue = decks.reduce((n, d) => n + d.dueCount, 0);

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Seus estudos</h1>
          <p className="text-sm text-neutral-500">
            {totalDue > 0
              ? `${totalDue} ${totalDue === 1 ? "cartão para revisar" : "cartões para revisar"} agora.`
              : "Nada para revisar agora. 🎉"}
          </p>
        </div>
        <div className="flex gap-2">
          <NotificationToggle />
          {totalDue > 0 && (
            <Link href="/review/all" className="btn-primary">
              Revisar agora ({totalDue})
            </Link>
          )}
        </div>
      </section>

      <NewDeckForm />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Materiais</h2>
        {decks.length === 0 ? (
          <p className="text-sm text-neutral-500">Nenhum material ainda. Cole um texto de aula ou um link acima para começar.</p>
        ) : (
          <ul className="space-y-3">
            {decks.map((deck) => (
              <li key={deck.id}>
                <Link href={`/deck/${deck.id}`} className="card flex items-center justify-between gap-4 transition hover:border-indigo-400">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{deck.title}</p>
                    <p className="text-sm text-neutral-500">
                      {deck.cardCount} cartões · {deck.learnedCount} memorizados
                      {deck.nextDue !== null && ` · próxima revisão ${formatDue(deck.nextDue, now)}`}
                    </p>
                  </div>
                  {deck.dueCount > 0 && (
                    <span className="shrink-0 rounded-full bg-indigo-100 px-2.5 py-0.5 text-sm font-medium text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                      {deck.dueCount} para revisar
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
