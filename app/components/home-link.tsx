import { getCurrentUser } from "@/lib/server/auth";
import { HomeLinkClient } from "./home-link-client";

export function HomeLinkFallback() {
  return <span className="font-semibold tracking-tight">📚 Estudos</span>;
}

export async function HomeLink() {
  const user = await getCurrentUser();
  return <HomeLinkClient loggedIn={Boolean(user)} />;
}
