"use client";

import { useSearchParams } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { requestPasswordReset, signIn, signInWithGoogle, signUp } from "./actions";

type Mode = "signin" | "signup" | "reset";

const URL_ERRORS: Record<string, string> = {
  google: "Não foi possível entrar com o Google. Tente novamente.",
  link: "O link é inválido ou já foi usado. Peça um novo.",
  expirado: "O link expirou. Peça um novo.",
  "outro-navegador": "Se você clicou no link de confirmação, seu e-mail já está confirmado: entre com sua senha.",
  "outro-navegador-senha": "Abra o link de nova senha no mesmo navegador em que você o pediu (ou peça outro aqui).",
};

const inputClass =
  "w-full rounded-lg border border-black/10 bg-transparent p-2.5 text-sm outline-none focus:border-indigo-500 dark:border-white/15";

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("signin");
  const [signInState, signInAction, signingIn] = useActionState(signIn, undefined);
  const [signUpState, signUpAction, signingUp] = useActionState(signUp, undefined);
  const [resetState, resetAction, resetting] = useActionState(requestPasswordReset, undefined);
  const searchParams = useSearchParams();
  const urlError = URL_ERRORS[searchParams.get("erro") ?? ""];
  const accountDeleted = searchParams.get("conta") === "excluida";

  const state = { signin: signInState, signup: signUpState, reset: resetState }[mode];

  const done = signInState?.done || signUpState?.done;
  useEffect(() => {
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- recarregamento completo de propósito (segurança)
    if (done) window.location.assign("/");
  }, [done]);
  const action = { signin: signInAction, signup: signUpAction, reset: resetAction }[mode];
  const pending = signingIn || signingUp || resetting || Boolean(done);
  const error = state?.error ?? (mode === "signin" ? urlError : undefined);

  return (
    <div className="card space-y-4">
      {accountDeleted && mode === "signin" && (
        <p role="status" className="text-center text-sm text-green-600 dark:text-green-400">
          Conta excluída.
        </p>
      )}
      {mode !== "reset" && (
        <>
          <form action={signInWithGoogle}>
            <button className="btn-ghost w-full py-2.5">
              <GoogleIcon /> Continuar com Google
            </button>
          </form>
          <div className="flex items-center gap-3 text-xs text-neutral-500">
            <hr className="flex-1 border-black/10 dark:border-white/10" /> ou com e-mail
            <hr className="flex-1 border-black/10 dark:border-white/10" />
          </div>
        </>
      )}

      <form action={action} className="space-y-3" key={mode}>
        {mode === "reset" && (
          <p className="text-sm text-neutral-500">Informe seu e-mail e enviaremos um link para criar uma nova senha.</p>
        )}
        <input name="email" type="email" placeholder="seu@email.com" required maxLength={254} autoComplete="email" className={inputClass} />
        {mode !== "reset" && (
          <input
            name="password"
            type="password"
            placeholder={mode === "signin" ? "Senha" : "Senha (mín. 10 caracteres)"}
            required
            minLength={mode === "signup" ? 10 : undefined}
            maxLength={72}
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            onInput={mode === "signup" ? (e) => checkPasswordsMatch(e.currentTarget.form) : undefined}
            className={inputClass}
          />
        )}
        {mode === "signup" && (
          <input
            name="confirm"
            type="password"
            placeholder="Confirme a senha"
            required
            minLength={10}
            maxLength={72}
            autoComplete="new-password"
            onInput={(e) => checkPasswordsMatch(e.currentTarget.form)}
            onInvalid={(e) => {
              if (e.currentTarget.validity.valueMissing) e.currentTarget.setCustomValidity("Confirme a senha.");
            }}
            className={inputClass}
          />
        )}

        {error && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
        {state?.message && (
          <p role="status" className="text-sm text-green-600 dark:text-green-400">
            {state.message}
          </p>
        )}

        <button type="submit" disabled={pending} className="btn-primary w-full py-2.5">
          {pending ? "Aguarde…" : { signin: "Entrar", signup: "Criar conta", reset: "Enviar link" }[mode]}
        </button>
      </form>

      <div className="space-y-1 text-center text-sm text-neutral-500">
        {mode === "signin" && (
          <>
            <p>
              Não tem conta? <ModeLink onClick={() => setMode("signup")}>Criar conta</ModeLink>
            </p>
            <p>
              <ModeLink onClick={() => setMode("reset")}>Esqueci minha senha</ModeLink>
            </p>
          </>
        )}
        {mode !== "signin" && (
          <p>
            <ModeLink onClick={() => setMode("signin")}>Voltar para entrar</ModeLink>
          </p>
        )}
      </div>
    </div>
  );
}

function checkPasswordsMatch(form: HTMLFormElement | null) {
  const password = form?.elements.namedItem("password") as HTMLInputElement | null;
  const confirm = form?.elements.namedItem("confirm") as HTMLInputElement | null;
  if (!password || !confirm) return;
  confirm.setCustomValidity(confirm.value && confirm.value !== password.value ? "As senhas não conferem." : "");
}

function ModeLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-indigo-600 hover:underline dark:text-indigo-400">
      {children}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  );
}
