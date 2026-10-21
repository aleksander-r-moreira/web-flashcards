import Link from "next/link";
import { getCurrentUser } from "@/lib/server/auth";
import { Reminders } from "./reminders";
import { SignOutButton } from "./sign-out-button";

export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="flex items-center gap-4 text-sm">
      <Link href="/review/all" className="text-indigo-600 hover:underline dark:text-indigo-400">
        Revisar tudo
      </Link>
      <Link href="/conta" className="hidden max-w-48 truncate text-neutral-500 hover:underline sm:inline">
        {user.email}
      </Link>
      <Link href="/conta" className="text-neutral-500 hover:underline sm:hidden">
        Conta
      </Link>
      <SignOutButton />
      <Reminders />
    </div>
  );
}
