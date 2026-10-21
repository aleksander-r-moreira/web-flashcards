import { z } from "zod";

export const LIMITS = {
  textMin: 200,
  textMax: 60_000,
  urlMax: 2_000,
} as const;

export const GenerateRequestSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("text"),
    text: z
      .string()
      .trim()
      .min(LIMITS.textMin, `No mínimo ${LIMITS.textMin} caracteres.`)
      .max(LIMITS.textMax, `O texto passa do limite de ${LIMITS.textMax.toLocaleString("pt-BR")} caracteres. Divida em partes.`),
  }),
  z.object({
    kind: z.literal("url"),
    url: z.string().trim().max(LIMITS.urlMax, "Link longo demais.").pipe(z.url({ protocol: /^https?$/, error: "Link inválido. Use um endereço http ou https." })),
  }),
], { error: "Tipo de material inválido." });
export type GenerateRequest = z.infer<typeof GenerateRequestSchema>;

export const GeneratedDeckSchema = z.object({
  title: z.string().trim().min(1).max(200),
  keyPoints: z.array(z.string().trim().min(1).max(600)).min(1).max(20),
  flashcards: z
    .array(
      z.object({
        question: z.string().trim().min(1).max(500),
        answer: z.string().trim().min(1).max(1_000),
      }),
    )
    .min(1)
    .max(40),
});
export type GeneratedDeck = z.infer<typeof GeneratedDeckSchema>;
