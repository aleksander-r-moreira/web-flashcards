import { getCurrentUser } from "@/lib/server/auth";
import { getDueSummary } from "@/lib/server/data";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Não autenticado." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  try {
    return Response.json(await getDueSummary(user), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Indisponível." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
