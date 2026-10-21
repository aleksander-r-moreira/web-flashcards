import { Suspense } from "react";
import { requireUser } from "@/lib/server/auth";
import { NewPasswordForm } from "./new-password-form";

export default function NewPasswordPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6 pt-8">
      <h1 className="text-center text-2xl font-semibold tracking-tight">Criar nova senha</h1>
      <Suspense>
        <Guarded />
      </Suspense>
    </div>
  );
}

async function Guarded() {
  await requireUser();
  return <NewPasswordForm />;
}
