import { z } from "zod";

export const loginSchema = z.object({
  cpf: z.string().min(1, "CPF é obrigatório"),
  password: z.string().min(1, "Senha é obrigatória"),
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(1, "Refresh token é obrigatório"),
});

export const updatePasswordSchema = z.object({
  password: z.string().min(1, "Nova senha é obrigatória"),
  oldPassword: z.string().optional(),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("E-mail inválido"),
});
