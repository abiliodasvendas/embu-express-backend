import { TicketType, TicketStatus, TicketPriority } from "../constants/ticket.enum.js";

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
  latitude?: number | null;
  longitude?: number | null;
  ativo: boolean;
  tipo_cobranca?: 'FIXO_MENSAL' | 'DIARIA_MOTOBOY' | 'TAXA_ENTREGA';
  periodicidade?: 'QUINZENAL' | 'MENSAL' | 'SEMANAL';
  dia_vencimento_padrao?: number;
  empresa_emissora_padrao_id?: number | null;
  valor_contrato_mensal?: number;
  valor_base?: number;
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
  latitude?: number | null;
  longitude?: number | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Empresa {
  id: number;
  nome_fantasia: string;
  razao_social: string;
  cnpj: string;
  latitude?: number | null;
  longitude?: number | null;
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
  taxa_entrega?: number | null;
  data_inicio?: string | null;
  data_fim?: string | null;
  cliente?: Client;
  unidade?: Unidade;
  empresa?: Empresa;
  horarios?: any[];
  validar_localizacao?: boolean;
  tipo_alocacao?: 'PADRAO' | 'RESERVA' | 'FISCAL';
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
  id?: number;
  is_virtual?: boolean;
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

export interface CategoriaItem {
  id: number;
  nome: string;
  created_at?: string;
  updated_at?: string;
}

export interface ItemEquipamento {
  id: number;
  nome: string;
  categoria_id: number;
  latitude?: number | null;
  longitude?: number | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
  categoria?: CategoriaItem;
  total_alocado?: number;
}

export interface ColaboradorItem {
  id: number;
  colaborador_id: string;
  item_id: number;
  quantidade: number;
  observacao?: string | null;
  criado_por?: string | null;
  created_at?: string;
  updated_at?: string;
  item?: ItemEquipamento;
  colaborador?: { nome_completo: string; cpf: string };
  criado_por_usuario?: { nome_completo: string };
}

export interface Ticket {
  id: string;
  title: string;
  description: string;
  type: TicketType;
  status: TicketStatus;
  priority: TicketPriority;
  author_id: string;
  attachments: string[];
  created_at?: string;
  updated_at?: string;
  author?: {
    id: string;
    nome_completo: string;
  };
}

export interface TicketComment {
  id: string;
  ticket_id: string;
  author_id: string;
  content: string;
  created_at?: string;
  author?: {
    id: string;
    nome_completo: string;
  };
}

export interface Convenio {
  id: string;
  nome: string;
  latitude?: number | null;
  longitude?: number | null;
  ativo: boolean;
  token: string;
  empresa_id?: number | null;
  conta_bancaria_id?: string | null;
  created_at?: string;
}

export interface LancamentoConvenio {
  id: string;
  convenio_id: string;
  colaborador_id: string | null;
  data_lancamento: string;
  valor: number;
  descricao?: string;
  moto_embu: boolean;
  centro_custo?: string | null;
  veiculo_id?: string | null;
  created_at?: string;
  updated_at?: string;
  convenio?: Convenio;
  colaborador?: { id: string; nome_completo: string; cpf?: string };
}

export interface ContaBancaria {
  id: string;
  empresa_id: number;
  banco_nome: string;
  agencia?: string | null;
  conta?: string | null;
  tipo_conta?: string;
  latitude?: number | null;
  longitude?: number | null;
  ativo: boolean;
  created_at?: string;
  updated_at?: string;
  empresa?: Empresa;
}

export type StatusFatura = 'PENDENTE' | 'PAGO_PARCIAL' | 'LIQUIDADA' | 'CANCELADA';

export interface FaturaCliente {
  id: string;
  cliente_id: number;
  empresa_id: number;
  mes_competencia: number;
  ano_competencia: number;
  quinzena?: number | null;
  tipo_periodo?: 'QUINZENAL' | 'MENSAL' | 'SEMANAL';
  numero_periodo?: number;
  data_inicio_apuracao?: string;
  data_fim_apuracao?: string;
  valor_faturado: number;
  valor_pago: number;
  data_emissao: string;
  data_vencimento: string;
  status: StatusFatura;
  dias_esperados?: number;
  dias_trabalhados?: number;
  faltas_sem_cobertura?: number;
  numero_os?: string | null;
  observacoes?: string | null;
  is_previsao?: boolean;
  criado_por?: string | null;
  created_at?: string;
  updated_at?: string;
  cliente?: Client;
  empresa?: Empresa;
  recebimentos?: FaturaRecebimento[];
}

export interface LoteRecebimento {
  id: string;
  conta_bancaria_destino_id: string;
  data_deposito: string;
  valor_total_depositado: number;
  observacao?: string | null;
  criado_por?: string | null;
  created_at?: string;
  conta_bancaria?: ContaBancaria;
  itens?: FaturaRecebimento[];
}

export interface FaturaRecebimento {
  id: string;
  lote_recebimento_id?: string | null;
  fatura_id: string;
  conta_bancaria_id: string;
  data_recebimento: string;
  valor_alocado: number;
  observacao?: string | null;
  criado_por?: string | null;
  created_at?: string;
  fatura?: FaturaCliente;
  conta_bancaria?: ContaBancaria;
}

export interface TransferenciaIntercompany {
  id: string;
  fatura_recebimento_id?: string | null;
  empresa_credora_id: number;
  empresa_devedora_id: number;
  valor: number;
  data_fato_gerador: string;
  status: 'PENDENTE_ACERTO' | 'COMPENSADO';
  data_acerto?: string | null;
  comprovante_acerto_url?: string | null;
  observacao?: string | null;
  created_at?: string;
  updated_at?: string;
  empresa_credora?: Empresa;
  empresa_devedora?: Empresa;
  fatura_recebimento?: FaturaRecebimento;
}

export type CategoriaDespesa =
  | 'DESPESA_FIXA'
  | 'TRIBUTO_DAS'
  | 'PARCELAMENTO_FISCAL'
  | 'INVESTIMENTO_FINANCIAMENTO'
  | 'DESPESA_FINANCEIRA'
  | 'PROLABORE'
  | 'INVESTIMENTO_PATRIMONIAL'
  | 'CARTAO_CREDITO'
  | 'DESPESA_ADMINISTRATIVA'
  | 'DESPESA_FROTA_DOCUMENTO';
export type StatusDespesa = 'PENDENTE' | 'ADIADA' | 'PAGO' | 'CANCELADO';

export type TipoMovimentacaoAvulsa = 'ENTRADA' | 'SAIDA';
export type CategoriaMovimentacaoAvulsa =
  | 'FRETE_ESPORADICO'
  | 'RENDIMENTO_APLICACAO'
  | 'REEMBOLSO_CLIENTE'
  | 'DOACAO_APORTE'
  | 'OUTRAS_ENTRADAS'
  | 'DESPESA_OPERACIONAL_AVULSA'
  | 'REEMBOLSO_DESPESA'
  | 'TARIFA_BANCARIA'
  | 'OUTRAS_SAIDAS'
  | 'CLIENTE_A_VISTA'
  | 'REEMBOLSO'
  | 'OUTRAS_RECEITAS'
  | 'OUTRAS_DESPESAS';

export interface MovimentacaoAvulsa {
  id: string;
  empresa_id: number;
  conta_bancaria_id?: string | null;
  tipo_movimentacao: TipoMovimentacaoAvulsa;
  categoria: CategoriaMovimentacaoAvulsa;
  descricao: string;
  valor: number;
  data_movimentacao: string;
  mes_competencia: number;
  ano_competencia: number;
  criado_por?: string | null;
  created_at?: string;
  updated_at?: string;
  empresa?: Empresa;
  conta_bancaria?: ContaBancaria;
}

export interface DespesaOperacional {
  id: string;
  empresa_id?: number | null;
  categoria: CategoriaDespesa;
  descricao: string;
  mes_competencia: number;
  ano_competencia: number;
  valor_previsto: number;
  valor_pago?: number;
  data_vencimento: string;
  data_pagamento?: string | null;
  status: StatusDespesa;
  is_holding: boolean;
  grupo_parcelamento_id?: string | null;
  numero_parcela?: number | null;
  total_parcelas?: number | null;
  is_recorrente?: boolean;
  recorrencia_origem_id?: string | null;
  dia_vencimento_base?: number | null;
  is_previsao?: boolean;
  criado_por?: string | null;
  created_at?: string;
  updated_at?: string;
  empresa?: Empresa;
}

export interface FechamentoCaixaMensal {
  id: string;
  mes: number;
  ano: number;
  saldo_inicial_consolidado: number;
  fechado_por?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface AlocacaoTemporaria {
  id: string;
  reserva_id: string;
  titular_ausente_id?: string | null;
  cliente_id: number;
  unidade_id?: number | null;
  data_cobertura: string;
  alocado_por?: string | null;
  observacao?: string | null;
  created_at?: string;
  reserva?: Usuario;
  titular_ausente?: Usuario;
  cliente?: Client;
  unidade?: Unidade;
}

export type StatusFaturaFornecedorConvenio =
  | 'PENDENTE'
  | 'PAGO_PARCIAL'
  | 'PAGA'
  | 'CANCELADA'
  | 'EM_AUDITORIA'
  | 'APROVADA'
  | 'GLOSADA';

export interface FaturaFornecedorPagamento {
  id: string;
  fatura_fornecedor_id: string;
  conta_bancaria_id?: string | null;
  empresa_id?: number | null;
  data_pagamento: string;
  valor_pago: number;
  observacao?: string | null;
  comprovante_url?: string | null;
  criado_por?: string | null;
  created_at?: string;
  updated_at?: string;
  conta_bancaria?: ContaBancaria;
  empresa?: Empresa;
}

export interface FaturaFornecedorConvenio {
  id: string;
  convenio_id: string;
  mes_competencia: number;
  ano_competencia: number;
  data_vencimento: string;
  valor_total_fatura: number;
  status: StatusFaturaFornecedorConvenio;
  empresa_id?: number | null;
  conta_bancaria_id?: string | null;
  data_pagamento?: string | null;
  valor_pago?: number | null;
  observacoes?: string | null;
  is_previsao?: boolean;
  criado_por?: string | null;
  created_at?: string;
  updated_at?: string;
  convenio?: Convenio;
  pagamentos?: FaturaFornecedorPagamento[];
}

export interface AuditoriaConvenioResultado {
  convenio_id: string;
  convenio_nome: string;
  mes_competencia: number;
  ano_competencia: number;
  fatura_fornecedor?: FaturaFornecedorConvenio | null;
  total_fatura_fornecedor: number;
  total_descontado_motoboys: number;
  total_frota_propria: number;
  total_sem_vinculo: number;
  total_geral_lancamentos: number;
  saldo_a_cargo_embu: number;
  diferenca_nao_identificada: number;
  tem_risco_divergencia?: boolean;
  mensagem_risco?: string | null;
  lancamentos_motoboys: LancamentoConvenio[];
  lancamentos_frota_propria: LancamentoConvenio[];
  lancamentos_sem_vinculo: LancamentoConvenio[];
}

export interface ConvenioResumoItem {
  id: string;
  nome: string;
  latitude?: number | null;
  longitude?: number | null;
  ativo: boolean;
  empresa_id?: number | null;
  conta_bancaria_id?: string | null;
  total_consumido: number;
  total_motoboys: number;
  total_moto_embu_david: number;
  total_sem_vinculo: number;
  quantidade_lancamentos: number;
  total_colaboradores_distintos?: number;
  ticket_medio?: number;
  fatura_fornecedor?: {
    id: string;
    valor_total_fatura: number;
    data_vencimento: string;
    status: StatusFaturaFornecedorConvenio;
    saldo_embu: number;
    empresa_id?: number | null;
    conta_bancaria_id?: string | null;
    valor_pago?: number | null;
    data_pagamento?: string | null;
    is_previsao?: boolean;
    pagamentos?: FaturaFornecedorPagamento[];
  } | null;
}

export interface ResumoGeralConveniosResultado {
  periodo: { mes: number; ano: number };
  totais: {
    total_geral_consumido: number;
    total_motoboys: number;
    total_moto_embu_david: number;
    total_sem_vinculo: number;
    total_faturas_fornecedores: number;
    total_saldo_cargo_embu: number;
  };
  convenios: ConvenioResumoItem[];
  top_colaboradores?: Array<{
    colaborador_id: string;
    nome_completo: string;
    total_gasto: number;
    quantidade_lancamentos: number;
    convenios_utilizados: string[];
  }>;
  distribuicao_percentual?: Array<{
    convenio_id: string;
    nome: string;
    percentual: number;
    total: number;
  }>;
}

export interface AgingRecebiveisFaixa {
  faixa: 'A_VENCER' | 'ATRASO_1_15' | 'ATRASO_16_30' | 'ATRASO_MAIOR_30';
  descricao: string;
  quantidade_faturas: number;
  valor_total: number;
}

export interface AgingRecebiveisResultado {
  periodo?: { mes?: number; ano?: number };
  capital_giro_retido_rua: number;
  total_a_vencer: number;
  total_vencido: number;
  total_geral_pendente: number;
  faixas: AgingRecebiveisFaixa[];
  faturas_atrasadas: FaturaCliente[];
}

export interface BloqueioConvenio {
  id: string;
  colaborador_id: string;
  convenio_id: string | null;
  motivo: string | null;
  criado_em: string;
  criado_por?: string | null;
  criado_por_usuario?: {
    id: string;
    nome_completo: string;
  } | null;
  convenio?: {
    id: string;
    nome: string;
  } | null;
  colaborador?: {
    id: string;
    nome_completo: string;
    cpf?: string;
    status?: 'PENDENTE' | 'ATIVO' | 'INATIVO';
  } | null;
}

export interface ElegibilidadeConvenioResultado {
  bloqueado: boolean;
  tipo_bloqueio?: 'MANUAL' | 'LIMITE_MARGEM' | null;
  motivo?: string | null;
  teto_limite?: number;
  saldo_disponivel?: number;
  total_gasto_mes?: number;
}
