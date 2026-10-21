import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm space-y-6 pt-8">
      <div className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Entre para estudar</h1>
        <p className="text-sm text-neutral-500">Resumos e flashcards gerados por IA, com revisões no momento certo.</p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
      <p className="text-center text-sm text-neutral-500">
        Quer só experimentar?{" "}
        <Link href="/visitante" className="text-indigo-600 hover:underline dark:text-indigo-400">
          Testar sem conta
        </Link>
      </p>
    </div>
  );
}
