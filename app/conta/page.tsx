import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireUser } from "@/lib/server/auth";
import { DeleteAccountForm } from "./delete-account-form";

export const metadata: Metadata = {
  title: "Conta · Estudos",
};

export default function AccountPage() {
  return (
    <Suspense fallback={<p className="text-sm text-neutral-500">Carregando…</p>}>
      <AccountContent />
    </Suspense>
  );
}

async function AccountContent() {
  const user = await requireUser();
  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm text-neutral-500 hover:underline">
          ← Materiais
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">Conta</h1>
        <p className="text-sm text-neutral-500">{user.email}</p>
      </div>

      <section className="card space-y-4 border-red-300 dark:border-red-500/40">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400">Excluir minha conta</h2>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Apaga sua conta, seus materiais e todo o progresso. Não tem volta.
          </p>
        </div>
        <DeleteAccountForm />
      </section>
    </div>
  );
}
