"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const NOTIFY_KEY = "estudos:last-notified";
const NOTIFY_GAP = 60 * 60_000;
const MAX_TIMEOUT = 2 ** 31 - 1;

export function Reminders() {
  const router = useRouter();

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    async function check() {
      let summary: { dueCount: number; nextDue: number | null };
      try {
        const res = await fetch("/api/reviews/summary", { cache: "no-store" });
        if (res.status === 401) {
          stop();
          return;
        }
        if (!res.ok) return;
        summary = await res.json();
      } catch {
        return;
      }
      if (stopped) return;

      const due = Number(summary.dueCount) || 0;
      document.title = due > 0 ? `(${due}) Revisar · Estudos` : "Estudos";

      clearTimeout(timeout);
      if (summary.nextDue) {
        timeout = setTimeout(check, Math.min(Math.max(summary.nextDue - Date.now(), 0) + 1000, MAX_TIMEOUT));
      }

      if (due === 0 || typeof Notification === "undefined" || Notification.permission !== "granted") return;
      let last = 0;
      try {
        last = Number(localStorage.getItem(NOTIFY_KEY) ?? 0);
      } catch {}
      if (Date.now() - last < NOTIFY_GAP) return;
      try {
        localStorage.setItem(NOTIFY_KEY, String(Date.now()));
      } catch {}
      const n = new Notification("Hora de revisar!", {
        body: `${due} ${due === 1 ? "cartão está pronto" : "cartões estão prontos"} para revisão.`,
        tag: "estudos-revisao",
      });
      n.onclick = () => {
        window.focus();
        router.push("/review/all");
      };
    }

    const interval = setInterval(check, 60_000);
    function stop() {
      stopped = true;
      clearTimeout(timeout);
      clearInterval(interval);
    }
    check();
    return stop;
  }, [router]);

  return null;
}
