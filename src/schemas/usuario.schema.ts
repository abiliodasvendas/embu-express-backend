import { z } from "zod";

export const createUsuarioSchema = z.object({
  email: z.string().email("Email inválido"),
  nome_completo: z.string().min(3, "Nome muito curto"),
  cpf: z.string().min(11, "CPF inválido"),
  perfil_id: z.union([z.number(), z.string()]).transform(val => Number(val)),
  telefone: z.string().optional(),
  telefone_recado: z.string().optional().nullable(),
  cnpj: z.string().optional().nullable(),
  tipo_chave_pix: z.string().optional(),
  chave_pix: z.string().optional().nullable(),
  status: z.string().optional(),
  empresa_id: z.number().optional().nullable(),
  cliente_id: z.number().optional().nullable(),
});

export const updateUsuarioSchema = createUsuarioSchema.partial().extend({
  ativo: z.boolean().optional(),
});

export const usuarioStatusSchema = z.object({
  status: z.string().min(1, "Status obrigatório")
});
