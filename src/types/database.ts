export interface Perfil {
  id: number;
  nome: string;
  descricao?: string;
  total_colaboradores?: number;
  created_at?: string;
  perfil_permissoes?: PerfilPermissao[];
}

export interface Client {
  id: number;
  public_id: string;
  nome_fantasia: string;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Unidade {
  id: number;
  cliente_id: number;
  nome_unidade: string;
  razao_social: string;
  cnpj: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  estado: string;
  km_contratados?: number | null;
  escala_semanal?: number[] | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Empresa {
  id: number;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  ativo: boolean;
  created_at?: string;
  codigo?: string | null;
}

export interface Usuario {
  id: string;
  perfil_id: number;
  nome_completo: string;
  cpf: string;
  email: string;
  senha_padrao: boolean;
  status: 'PENDENTE' | 'ATIVO' | 'INATIVO';
  created_at?: string;
  updated_at?: string;
  data_nascimento?: string | null;
  rg?: string | null;
  nome_mae?: string | null;
  endereco_completo?: string | null;
  telefone?: string | null;
  telefone_recado?: string | null;
  cnh_registro?: string | null;
  cnh_vencimento?: string | null;
  cnh_categoria?: string | null;
  cnpj?: string | null;
  tipo_chave_pix?: string | null;
  chave_pix?: string | null;
  moto_modelo?: string | null;
  moto_cor?: string | null;
  moto_ano?: string | null;
  moto_placa?: string | null;
  valor_mei?: number | null;
  perfil?: Perfil;
  links?: ColaboradorCliente[];
}

export interface PontoLocation {
  lat: number;
  lng: number;
  accuracy?: number;
  address?: string;
}

export interface PontoMetadata {
  accuracy?: number;
  address?: string;
  device?: string;
}

export interface DetalhesCalculo {
  entrada: {
    turno_base: string | null;
    diff_minutos: number;
    tolerancia: number;
  };
  saida: {
    turno_base: string | null;
    diff_minutos: number;
    tolerancia: number;
    limite_he_excessiva?: number;
  };
  resumo: {
    horas_trabalhadas: string;
    horas_pausa: string;
    pausa_total: number;
    pausa_configurada: number;
    pausa_extra: number;
    km_trabalhado: number;
    km_pausa: number;
    diff_km?: number;
    total_trabalhado?: string;
  };
}

export interface RegistroPonto {
  id: number;
  usuario_id: string;
  data_referencia: string;
  entrada_hora: string;
  saida_hora?: string | null;
  status_entrada: string;
  status_saida?: string;
  saldo_minutos?: number | null;
  cliente_id?: number | null;
  empresa_id?: number | null;
  colaborador_cliente_id?: number | null;
  detalhes_calculo?: DetalhesCalculo | null;
  entrada_loc?: PontoLocation | null;
  entrada_lat?: number | null;
  entrada_lng?: number | null;
  entrada_km?: number | null;
  entrada_metadata?: PontoMetadata | null;
  saida_loc?: PontoLocation | null;
  saida_lat?: number | null;
  saida_lng?: number | null;
  saida_km?: number | null;
  saida_metadata?: PontoMetadata | null;
  saida_distancia_trabalho?: number | null;
  total_pausas_minutos?: number | null;
  created_at?: string;
  updated_at?: string;
  usuario?: Usuario;
  pausas?: Pausa[];
  cliente?: Client;
  ausente?: boolean;
}

export interface Pausa {
  id: number;
  ponto_id: number;
  inicio_hora: string;
  fim_hora?: string | null;
  inicio_km?: number | null;
  fim_km?: number | null;
  inicio_loc?: PontoLocation | null;
  inicio_lat?: number | null;
  inicio_lng?: number | null;
  inicio_metadata?: PontoMetadata | null;
  fim_loc?: PontoLocation | null;
  fim_lat?: number | null;
  fim_lng?: number | null;
  fim_metadata?: PontoMetadata | null;
  distancia_trabalho?: number | null;
  distancia_pausa?: number | null;
  created_at?: string;
  updated_at?: string;
}

export interface ColaboradorClienteHorario {
  id: number;
  colaborador_cliente_id: number;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  tolerancia_pausa_min: number;
  created_at?: string;
}

export interface ColaboradorCliente {
  id: number;
  colaborador_id: string;
  cliente_id: number;
  unidade_id: number;
  empresa_id: number;
  valor_contrato: number;
  valor_aluguel?: number | null;
  valor_bonus?: number | null;
  ajuda_custo?: number | null;
  valor_adiantamento?: number | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  cliente?: Client;
  unidade?: Unidade;
  empresa?: Empresa;
  horarios?: any[];
  created_at?: string;
  updated_at?: string;
}

export interface Feriado {
  id: number;
  data: string;
  descricao: string;
  created_at?: string;
}

export interface Permissao {
  id: number;
  nome: string;
  nome_interno: string;
  descricao?: string;
  modulo?: string;
}

export interface PerfilPermissao {
  id: number;
  perfil_id: number;
  permissao_id: number;
  permissao?: Permissao;
}

export interface TipoOcorrencia {
  id: number;
  descricao: string;
  impacto_financeiro?: boolean;
  valor_padrao?: number | null;
  tipo_lancamento?: 'ENTRADA' | 'SAIDA';
  created_at?: string;
}

export interface Ocorrencia {
  id: number;
  colaborador_id: string;
  colaborador_cliente_id?: number | null;
  tipo_id: number;
  data_ocorrencia: string;
  valor?: number | null;
  impacto_financeiro?: boolean;
  tipo_lancamento?: 'ENTRADA' | 'SAIDA';
  observacao: string;
  criado_por?: string;
  created_at?: string;
  updated_at?: string;
  tipo?: Partial<TipoOcorrencia>;
  colaborador?: Partial<Usuario>;
  criado_por_usuario?: Partial<Usuario>;
  vinculo?: Partial<ColaboradorCliente>;
}
