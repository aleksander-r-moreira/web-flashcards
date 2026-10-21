"use client";

import { useLayoutEffect, useState } from "react";
import { deleteDeckAction } from "@/app/actions";

export function DeleteDeckButton({ deckId }: { deckId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  useLayoutEffect(
    () => () => {
      setConfirming(false);
      setPending(false);
      setFailed(false);
    },
    [],
  );

  async function remove() {
    setPending(true);
    setFailed(false);
    let failedNow = true;
    try {
      const result = await deleteDeckAction(deckId);
      failedNow = result ? !result.ok : false;
    } catch {
      failedNow = true;
    }
    if (!failedNow) return;
    setPending(false);
    setConfirming(false);
    setFailed(true);
  }

  if (!confirming) {
    return (
      <div className="relative">
        <button className="btn-ghost h-full text-red-600" onClick={() => setConfirming(true)}>
          Excluir
        </button>
        {failed && (
          <span role="alert" className="absolute right-0 top-full mt-1 whitespace-nowrap text-xs text-red-600">
            Falha ao excluir. Tente de novo.
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button className="btn bg-red-600 text-white hover:bg-red-500" disabled={pending} onClick={remove} autoFocus>
        {pending ? "Excluindo…" : "Confirmar exclusão"}
      </button>
      <button className="btn-ghost" disabled={pending} onClick={() => setConfirming(false)}>
        Cancelar
      </button>
    </div>
  );
}
