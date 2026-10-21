"use server";

import { redirect } from "next/navigation";
import { EmailSchema, PasswordSchema, SignInSchema, SignUpSchema } from "@/lib/auth-schemas";
import { takeAttempt } from "@/lib/server/attempt-limit";
import { requireUser } from "@/lib/server/auth";
import { env } from "@/lib/server/env";
import { createClient } from "@/lib/server/supabase";

export type FormState = { error?: string; message?: string; done?: boolean } | undefined;

const field = (fd: FormData, name: string) => String(fd.get(name) ?? "");
function emailErrorMessage(code: string | undefined): string | null {
  if (code === "over_email_send_rate_limit") return "Limite de e-mails atingido. Tente mais tarde ou entre com o Google.";
  if (code === "email_address_not_authorized") return "Não conseguimos enviar e-mail para este endereço. Entre com o Google.";
  return null;
}

const waitMessage = (sec: number) => `Muitas tentativas. Aguarde ${Math.ceil(sec / 60)} min e tente de novo.`;

export async function signInWithGoogle(): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${env().SITE_URL}/auth/callback` },
  });
  if (error || !data.url) redirect("/login?erro=google");
  redirect(data.url);
}

export async function signIn(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = SignInSchema.safeParse({ email: field(fd, "email"), password: field(fd, "password") });
  if (!parsed.success) return { error: "E-mail ou senha incorretos." };

  const wait = await takeAttempt("login", parsed.data.email);
  if (wait > 0) return { error: waitMessage(wait) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") return { error: "Confirme seu e-mail." };
    return { error: "E-mail ou senha incorretos." };
  }
  return { done: true };
}

export async function signUp(_: FormState, fd: FormData): Promise<FormState> {
  const parsed = SignUpSchema.safeParse({ email: field(fd, "email"), password: field(fd, "password") });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  if (field(fd, "confirm") !== parsed.data.password) return { error: "As senhas não conferem." };

  const wait = await takeAttempt("signup", parsed.data.email);
  if (wait > 0) return { error: waitMessage(wait) };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${env().SITE_URL}/auth/callback` },
  });
  const sent = { message: "Enviamos um link de confirmação. Confira sua caixa de entrada." };
  if (error) {
    console.error("Erro no cadastro:", error.code, error.message);
    if (error.code === "weak_password") return { error: "Senha fraca." };
    if (error.code === "user_already_exists" || error.code === "email_exists") return sent;
    const emailIssue = emailErrorMessage(error.code);
    if (emailIssue) return { error: emailIssue };
    return { error: "Falha ao criar a conta. Tente de novo." };
  }
  if (data?.session) return { done: true };
  return sent;
}

export async function requestPasswordReset(_: FormState, fd: FormData): Promise<FormState> {
  const email = EmailSchema.safeParse(field(fd, "email"));
  const generic = { message: "Enviamos um link para criar uma nova senha." };
  if (!email.success) return { error: "E-mail inválido." };

  const wait = await takeAttempt("reset", email.data);
  if (wait > 0) return generic;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.data, {
    redirectTo: `${env().SITE_URL}/auth/callback?next=/auth/nova-senha`,
  });
  if (error) {
    console.error("Erro ao pedir recuperação:", error.code, error.message);
    const emailIssue = emailErrorMessage(error.code);
    if (emailIssue) return { error: emailIssue };
  }
  return generic;
}

export async function updatePassword(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = PasswordSchema.safeParse(field(fd, "password"));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  if (parsed.data !== field(fd, "confirm")) return { error: "As senhas não conferem." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) {
    if (error.code === "same_password") return { error: "A nova senha precisa ser diferente da atual." };
    if (error.code === "weak_password") return { error: "Senha fraca ou já vazada em outros sites. Escolha outra." };
    console.error("Erro ao trocar senha:", user.id, error.code);
    return { error: "Não foi possível trocar a senha. Tente pedir um novo link." };
  }
  await supabase.auth.signOut({ scope: "others" });
  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
}
