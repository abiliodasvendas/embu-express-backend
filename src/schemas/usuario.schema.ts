import { z } from "zod";
import { onlyNumbers } from "../utils/utils.js";

export const createUsuarioSchema = z.object({
  email: z.string().email("Email inválido"),
  nome_completo: z.string().min(3, "Nome muito curto"),
  cpf: z.string().min(11, "CPF inválido").transform(onlyNumbers),
  perfil_id: z.coerce.number(),
  telefone: z.string().min(1, "Telefone obrigatório").transform(onlyNumbers),
  telefone_recado: z.string().optional().nullable().transform(val => val ? onlyNumbers(val) : val),
  cnpj: z.string().optional().nullable().transform(val => val ? onlyNumbers(val) : val),
  tipo_chave_pix: z.string().optional().nullable(),
  chave_pix: z.string().optional().nullable(),
  status: z.string().optional(),
  empresa_id: z.number().optional().nullable(),
  cliente_id: z.number().optional().nullable(),
  rg: z.string().optional().nullable(),
  data_nascimento: z.string().optional().nullable(),
  nome_mae: z.string().optional().nullable(),
  endereco_completo: z.string().optional().nullable(),
  moto_modelo: z.string().optional().nullable(),
  moto_cor: z.string().optional().nullable(),
  moto_placa: z.string().optional().nullable(),
  moto_ano: z.string().optional().nullable(),
  cnh_registro: z.string().optional().nullable(),
  cnh_categoria: z.string().optional().nullable(),
  cnh_vencimento: z.string().optional().nullable(),
  // Campos de controle/metadados que podem vir do front
  links: z.array(z.object({
    id: z.number().optional(),
    cliente_id: z.number().optional(),
    empresa_id: z.number().optional(),
    hora_inicio: z.string().optional(),
    hora_fim: z.string().optional(),
  }).passthrough()).optional(),
  turnos: z.array(z.record(z.string(), z.unknown())).optional(),
  silent: z.boolean().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const updateUsuarioSchema = createUsuarioSchema.partial().extend({
  ativo: z.boolean().optional(),
});

export const usuarioStatusSchema = z.object({
  status: z.string().min(1, "Status obrigatório")
});
