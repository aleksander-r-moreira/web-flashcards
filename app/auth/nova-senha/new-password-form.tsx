"use client";

import { useActionState } from "react";
import { updatePassword } from "@/app/login/actions";

const inputClass =
  "w-full rounded-lg border border-black/10 bg-transparent p-2.5 text-sm outline-none focus:border-indigo-500 dark:border-white/15";

export function NewPasswordForm() {
  const [state, action, pending] = useActionState(updatePassword, undefined);
  return (
    <form action={action} className="card space-y-3">
      <input name="password" type="password" placeholder="Nova senha (mín. 10 caracteres)" required minLength={10} maxLength={72} autoComplete="new-password" className={inputClass} />
      <input name="confirm" type="password" placeholder="Repita a nova senha" required minLength={10} maxLength={72} autoComplete="new-password" className={inputClass} />
      {state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn-primary w-full py-2.5">
        {pending ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
