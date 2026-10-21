"use client";

import { useActionState, useEffect, useState } from "react";
import { deleteAccount } from "./actions";

export function DeleteAccountForm() {
  const [state, action, pending] = useActionState(deleteAccount, undefined);
  const [confirm, setConfirm] = useState("");
  const done = Boolean(state?.done);

  useEffect(() => {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- recarregamento completo de propósito (segurança)
    if (done) window.location.assign("/login?conta=excluida");
  }, [done]);

  return (
    <form action={action} className="space-y-3">
      <label className="block space-y-1 text-sm">
        <span>
          Digite <strong>EXCLUIR</strong> para confirmar:
        </span>
        <input
          name="confirm"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          maxLength={20}
          className="w-full rounded-lg border border-black/10 bg-transparent p-2.5 text-sm outline-none focus:border-red-500 dark:border-white/15"
        />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending || done || confirm.trim() !== "EXCLUIR"}
        className="btn bg-red-600 text-white hover:bg-red-500"
      >
        {pending || done ? "Excluindo…" : "Excluir minha conta"}
      </button>
    </form>
  );
}
