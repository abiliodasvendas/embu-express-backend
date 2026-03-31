import { z } from "zod";
import { onlyNumbers } from "../utils/utils.js";

export const loginSchema = z.object({
  cpf: z.string().min(1, "CPF é obrigatório").transform(onlyNumbers),
  password: z.string().min(1, "Senha é obrigatória"),
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(1, "Refresh token é obrigatório"),
});

export const updatePasswordSchema = z.object({
  password: z.string().min(1, "Nova senha é obrigatória"),
  oldPassword: z.string().optional(),
});

export const registerSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres"),
  nome_completo: z.string().min(3, "Nome muito curto"),
  cpf: z.string().min(11, "CPF inválido").transform(onlyNumbers),
  rg: z.string().optional().nullable().transform(val => val ? onlyNumbers(val) : val),
  telefone: z.string().optional().nullable().transform(val => val ? onlyNumbers(val) : val),
  telefone_recado: z.string().optional().nullable().transform(val => val ? onlyNumbers(val) : val),
  data_nascimento: z.string().optional().nullable(),
  nome_mae: z.string().min(3, "Nome da mãe muito curto"),
  endereco_completo: z.string().min(5, "Endereço obrigatório"),
  moto_modelo: z.string().min(1, "Modelo obrigatório"),
  moto_cor: z.string().min(1, "Cor obrigatória"),
  moto_ano: z.string().min(4, "Ano obrigatório"),
  moto_placa: z.string().min(7, "Placa obrigatória"),
  cnh_registro: z.string().optional().nullable().transform(val => val ? onlyNumbers(val) : val),
  cnh_vencimento: z.string().optional().nullable(),
  cnh_categoria: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable().transform(val => val ? onlyNumbers(val) : val),
  tipo_chave_pix: z.string().optional(),
  chave_pix: z.string().optional().nullable(),
  perfil_id: z.coerce.number(),
});
