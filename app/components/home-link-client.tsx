"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function HomeLinkClient({ loggedIn }: { loggedIn: boolean }) {
  const pathname = usePathname();
  const href = loggedIn ? "/" : pathname.startsWith("/visitante") ? "/visitante" : "/login";
  return (
    <Link href={href} className="font-semibold tracking-tight">
      📚 Estudos
    </Link>
  );
}
