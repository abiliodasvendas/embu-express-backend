import { z } from "zod";
import { onlyNumbers } from "../utils/utils.js";

export const optionalIsoDate = z
  .string()
  .optional()
  .nullable()
  .transform((val) => {
    if (!val || val.trim() === "") return null;
    const trimmed = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    const parts = trimmed.split("/");
    if (parts.length === 3) {
      const [day, month, rawYear] = parts;
      let year = rawYear.trim();
      if (year.length === 2) {
        const num = parseInt(year, 10);
        year = num >= 50 ? `19${year}` : `20${year}`;
      }
      if (year.length === 4 && day && month) {
        return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
      }
    }
    return trimmed;
  })
  .refine(
    (val) => !val || /^\d{4}-\d{2}-\d{2}$/.test(val),
    { message: "Formato de data inválido (esperado AAAA-MM-DD ou DD/MM/AAAA)" }
  );

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
  telefone: z.string().min(1, "Telefone obrigatório").transform(onlyNumbers),
  telefone_recado: z.string().optional().nullable().transform(val => val ? onlyNumbers(val) : val),
  data_nascimento: optionalIsoDate,
  nome_mae: z.string().min(3, "Nome da mãe muito curto"),
  endereco_completo: z.string().min(5, "Endereço obrigatório"),
  moto_modelo: z.string().min(1, "Modelo obrigatório"),
  moto_cor: z.string().min(1, "Cor obrigatória"),
  moto_ano: z.string().min(4, "Ano obrigatório"),
  moto_placa: z.string().min(7, "Placa obrigatória"),
  cnh_registro: z.string().optional().nullable().transform(val => val ? onlyNumbers(val) : val),
  cnh_vencimento: optionalIsoDate,
  cnh_categoria: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable().transform(val => val ? onlyNumbers(val) : val),
  tipo_chave_pix: z.string().optional(),
  chave_pix: z.string().optional().nullable(),
  perfil_id: z.coerce.number(),
});
