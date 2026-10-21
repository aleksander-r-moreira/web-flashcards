"use client";

import { useTransition } from "react";
import { signOut } from "@/app/login/actions";

export function SignOutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      className="text-neutral-500 hover:underline"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await signOut();
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign("/login");
        })
      }
    >
      {pending ? "Saindo…" : "Sair"}
    </button>
  );
}
