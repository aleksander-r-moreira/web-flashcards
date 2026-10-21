import { z } from "zod";

export const EmailSchema = z.email("E-mail inválido.").max(254, "E-mail longo demais.").transform((e) => e.trim().toLowerCase());

export const PasswordSchema = z
  .string()
  .min(10, "A senha precisa ter pelo menos 10 caracteres.")
  .refine((p) => new TextEncoder().encode(p).length <= 72, "A senha pode ter no máximo 72 bytes.");

export const SignUpSchema = z
  .object({ email: EmailSchema, password: PasswordSchema })
  .refine((v) => {
    const user = v.email.split("@")[0];
    return user.length < 4 || !v.password.toLowerCase().includes(user);
  }, {
    message: "A senha não pode conter o seu e-mail.",
    path: ["password"],
  });

export const SignInSchema = z.object({ email: EmailSchema, password: z.string().min(1).max(200) });
