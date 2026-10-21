"use client";

import { useState, useSyncExternalStore } from "react";

const subscribeNoop = () => () => {};

export function NotificationToggle() {
  const permission = useSyncExternalStore(
    subscribeNoop,
    () => (typeof Notification === "undefined" ? "unsupported" : Notification.permission),
    () => "unsupported",
  );
  const [, rerender] = useState(0);

  if (permission === "unsupported" || permission === "granted") return null;
  if (permission === "denied") {
    return <span className="self-center text-xs text-neutral-500">Notificações bloqueadas no navegador</span>;
  }
  return (
    <button
      className="btn-ghost"
      onClick={async () => {
        await Notification.requestPermission();
        rerender((n) => n + 1);
      }}
    >
      🔔 Ativar lembretes
    </button>
  );
}
