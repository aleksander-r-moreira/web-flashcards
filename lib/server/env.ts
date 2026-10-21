import "server-only";
import { z } from "zod";

const EnvSchema = z.object({
  SITE_URL: z.url().transform((u) => u.replace(/\/$/, "")),
  SUPABASE_URL: z.url().startsWith("https://"),
  SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  SUPABASE_SECRET_KEY: z.string().min(20),
  GEMINI_API_KEY: z.string().min(20),
  GEMINI_MODEL: z.string().default("gemini-3.5-flash-lite"),
});

let cached: z.infer<typeof EnvSchema> | undefined;

export function env() {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Variáveis de ambiente ausentes ou inválidas: ${missing}. Veja o README.`);
  }
  cached = parsed.data;
  return cached;
}
