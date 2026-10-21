"use server";

import { requireUser } from "@/lib/server/auth";
import { createAdminClient, createClient } from "@/lib/server/supabase";

export type DeleteAccountState = { error?: string; done?: boolean } | undefined;

export async function deleteAccount(_: DeleteAccountState, fd: FormData): Promise<DeleteAccountState> {
  if (String(fd.get("confirm") ?? "").trim() !== "EXCLUIR") return { error: "Digite EXCLUIR para confirmar." };

  const user = await requireUser();
  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) {
    console.error("Erro ao excluir conta:", user.id, error.code ?? error.message);
    return { error: "Falha ao excluir a conta. Tente de novo." };
  }

  try {
    const supabase = await createClient();
    await supabase.auth.signOut({ scope: "local" });
  } catch {}
  return { done: true };
}
