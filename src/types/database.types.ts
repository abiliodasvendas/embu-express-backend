export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alocacoes_temporarias: {
        Row: {
          alocado_por: string | null
          cliente_id: number
          created_at: string | null
          data_cobertura: string
          id: string
          observacao: string | null
          reserva_id: string
          titular_ausente_id: string | null
          unidade_id: number | null
        }
        Insert: {
          alocado_por?: string | null
          cliente_id: number
          created_at?: string | null
          data_cobertura: string
          id?: string
          observacao?: string | null
          reserva_id: string
          titular_ausente_id?: string | null
          unidade_id?: number | null
        }
        Update: {
          alocado_por?: string | null
          cliente_id?: number
          created_at?: string | null
          data_cobertura?: string
          id?: string
          observacao?: string | null
          reserva_id?: string
          titular_ausente_id?: string | null
          unidade_id?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "alocacoes_temporarias_alocado_por_fkey"
            columns: ["alocado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alocacoes_temporarias_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alocacoes_temporarias_reserva_id_fkey"
            columns: ["reserva_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alocacoes_temporarias_titular_ausente_id_fkey"
            columns: ["titular_ausente_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alocacoes_temporarias_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades_cliente"
            referencedColumns: ["id"]
          },
        ]
      }
      app_updates: {
        Row: {
          changelog: string | null
          created_at: string
          force_update: boolean
          id: number
          latest_version: string
          platform: string
          url_zip: string
        }
        Insert: {
          changelog?: string | null
          created_at?: string
          force_update?: boolean
          id?: number
          latest_version: string
          platform: string
          url_zip: string
        }
        Update: {
          changelog?: string | null
          created_at?: string
          force_update?: boolean
          id?: number
          latest_version?: string
          platform?: string
          url_zip?: string
        }
        Relationships: []
      }
      ativmob_webhook_events: {
        Row: {
          agent_code: string | null
          agent_name: string | null
          codigo_roteiro: string | null
          created_at: string
          error_message: string | null
          event_code: string | null
          event_dth: string | null
          event_id: number | null
          event_title: string | null
          form: Json | null
          id: string
          invoice_number: string | null
          lat: number | null
          lng: number | null
          order_number: string | null
          raw_payload: Json
          status: string
          store_cnpj: string | null
          updated_at: string
        }
        Insert: {
          agent_code?: string | null
          agent_name?: string | null
          codigo_roteiro?: string | null
          created_at?: string
          error_message?: string | null
          event_code?: string | null
          event_dth?: string | null
          event_id?: number | null
          event_title?: string | null
          form?: Json | null
          id?: string
          invoice_number?: string | null
          lat?: number | null
          lng?: number | null
          order_number?: string | null
          raw_payload: Json
          status?: string
          store_cnpj?: string | null
          updated_at?: string
        }
        Update: {
          agent_code?: string | null
          agent_name?: string | null
          codigo_roteiro?: string | null
          created_at?: string
          error_message?: string | null
          event_code?: string | null
          event_dth?: string | null
          event_id?: number | null
          event_title?: string | null
          form?: Json | null
          id?: string
          invoice_number?: string | null
          lat?: number | null
          lng?: number | null
          order_number?: string | null
          raw_payload?: Json
          status?: string
          store_cnpj?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      ausencias_manuais: {
        Row: {
          criado_em: string
          data_referencia: string
          id: string
          usuario_id: string
        }
        Insert: {
          criado_em?: string
          data_referencia: string
          id?: string
          usuario_id: string
        }
        Update: {
          criado_em?: string
          data_referencia?: string
          id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ausencias_manuais_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      bloqueios_convenios: {
        Row: {
          colaborador_id: string
          convenio_id: string | null
          criado_em: string | null
          criado_por: string | null
          id: string
          motivo: string | null
        }
        Insert: {
          colaborador_id: string
          convenio_id?: string | null
          criado_em?: string | null
          criado_por?: string | null
          id?: string
          motivo?: string | null
        }
        Update: {
          colaborador_id?: string
          convenio_id?: string | null
          criado_em?: string | null
          criado_por?: string | null
          id?: string
          motivo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bloqueios_convenios_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bloqueios_convenios_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bloqueios_convenios_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      categoria_itens: {
        Row: {
          created_at: string
          id: number
          nome: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          nome: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          nome?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      clientes: {
        Row: {
          ativo: boolean
          created_at: string
          id: number
          nome_fantasia: string
          public_id: string
          updated_at: string | null
          valor_diaria_glosa: number | null
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: number
          nome_fantasia: string
          public_id?: string
          updated_at?: string | null
          valor_diaria_glosa?: number | null
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: number
          nome_fantasia?: string
          public_id?: string
          updated_at?: string | null
          valor_diaria_glosa?: number | null
        }
        Relationships: []
      }
      colaborador_cliente_horarios: {
        Row: {
          colaborador_cliente_id: number
          created_at: string | null
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id: number
          tolerancia_pausa_min: number | null
        }
        Insert: {
          colaborador_cliente_id: number
          created_at?: string | null
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id?: number
          tolerancia_pausa_min?: number | null
        }
        Update: {
          colaborador_cliente_id?: number
          created_at?: string | null
          dia_semana?: number
          hora_fim?: string
          hora_inicio?: string
          id?: number
          tolerancia_pausa_min?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_horarios_colaborador_cliente"
            columns: ["colaborador_cliente_id"]
            isOneToOne: false
            referencedRelation: "colaborador_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      colaborador_clientes: {
        Row: {
          ajuda_custo: number | null
          cliente_id: number | null
          colaborador_id: string
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          empresa_id: number
          id: number
          taxa_entrega: number | null
          tipo_alocacao: string | null
          unidade_id: number
          updated_at: string | null
          validar_localizacao: boolean
          valor_adiantamento: number | null
          valor_aluguel: number | null
          valor_bonus: number | null
          valor_contrato: number
        }
        Insert: {
          ajuda_custo?: number | null
          cliente_id?: number | null
          colaborador_id: string
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id: number
          id?: number
          taxa_entrega?: number | null
          tipo_alocacao?: string | null
          unidade_id: number
          updated_at?: string | null
          validar_localizacao?: boolean
          valor_adiantamento?: number | null
          valor_aluguel?: number | null
          valor_bonus?: number | null
          valor_contrato?: number
        }
        Update: {
          ajuda_custo?: number | null
          cliente_id?: number | null
          colaborador_id?: string
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          empresa_id?: number
          id?: number
          taxa_entrega?: number | null
          tipo_alocacao?: string | null
          unidade_id?: number
          updated_at?: string | null
          validar_localizacao?: boolean
          valor_adiantamento?: number | null
          valor_aluguel?: number | null
          valor_bonus?: number | null
          valor_contrato?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_colaborador_cliente_cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_colaborador_cliente_empresa"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_colaborador_cliente_unidade"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades_cliente"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_colaborador_cliente_usuario"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      colaborador_itens: {
        Row: {
          colaborador_id: string
          created_at: string
          criado_por: string | null
          id: number
          item_id: number
          observacao: string | null
          quantidade: number
          updated_at: string | null
        }
        Insert: {
          colaborador_id: string
          created_at?: string
          criado_por?: string | null
          id?: number
          item_id: number
          observacao?: string | null
          quantidade?: number
          updated_at?: string | null
        }
        Update: {
          colaborador_id?: string
          created_at?: string
          criado_por?: string | null
          id?: number
          item_id?: number
          observacao?: string | null
          quantidade?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_colaborador_itens_criador"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_colaborador_itens_item"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itens_equipamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_colaborador_itens_usuario"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      configuracoes_sistema: {
        Row: {
          chave: string
          descricao: string | null
          updated_at: string | null
          valor: string
        }
        Insert: {
          chave: string
          descricao?: string | null
          updated_at?: string | null
          valor: string
        }
        Update: {
          chave?: string
          descricao?: string | null
          updated_at?: string | null
          valor?: string
        }
        Relationships: []
      }
      confirmacoes_adiantamento: {
        Row: {
          ano: number
          colaborador_id: string
          confirmado_por: string | null
          conta_bancaria_id: string | null
          created_at: string | null
          data_confirmacao: string | null
          data_pagamento: string | null
          id: number
          lote_pagamento_id: string | null
          mes: number
          valor: number | null
        }
        Insert: {
          ano: number
          colaborador_id: string
          confirmado_por?: string | null
          conta_bancaria_id?: string | null
          created_at?: string | null
          data_confirmacao?: string | null
          data_pagamento?: string | null
          id?: number
          lote_pagamento_id?: string | null
          mes: number
          valor?: number | null
        }
        Update: {
          ano?: number
          colaborador_id?: string
          confirmado_por?: string | null
          conta_bancaria_id?: string | null
          created_at?: string | null
          data_confirmacao?: string | null
          data_pagamento?: string | null
          id?: number
          lote_pagamento_id?: string | null
          mes?: number
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "confirmacoes_adiantamento_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmacoes_adiantamento_confirmado_por_fkey"
            columns: ["confirmado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmacoes_adiantamento_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "confirmacoes_adiantamento_lote_pagamento_id_fkey"
            columns: ["lote_pagamento_id"]
            isOneToOne: false
            referencedRelation: "lotes_pagamento"
            referencedColumns: ["id"]
          },
        ]
      }
      contas_bancarias: {
        Row: {
          agencia: string | null
          ativo: boolean | null
          banco_nome: string
          conta: string | null
          created_at: string | null
          empresa_id: number
          id: string
          tipo_conta: string | null
          updated_at: string | null
        }
        Insert: {
          agencia?: string | null
          ativo?: boolean | null
          banco_nome: string
          conta?: string | null
          created_at?: string | null
          empresa_id: number
          id?: string
          tipo_conta?: string | null
          updated_at?: string | null
        }
        Update: {
          agencia?: string | null
          ativo?: boolean | null
          banco_nome?: string
          conta?: string | null
          created_at?: string | null
          empresa_id?: number
          id?: string
          tipo_conta?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contas_bancarias_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      convenios: {
        Row: {
          ativo: boolean | null
          conta_bancaria_id: string | null
          created_at: string | null
          dia_vencimento_padrao: number
          empresa_id: number | null
          id: string
          nome: string
          periodicidade: string
          token: string
        }
        Insert: {
          ativo?: boolean | null
          conta_bancaria_id?: string | null
          created_at?: string | null
          dia_vencimento_padrao?: number
          empresa_id?: number | null
          id?: string
          nome: string
          periodicidade?: string
          token: string
        }
        Update: {
          ativo?: boolean | null
          conta_bancaria_id?: string | null
          created_at?: string | null
          dia_vencimento_padrao?: number
          empresa_id?: number | null
          id?: string
          nome?: string
          periodicidade?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "convenios_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "convenios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      despesas_operacionais: {
        Row: {
          ano_competencia: number
          categoria: string
          conta_bancaria_id: string | null
          created_at: string | null
          criado_por: string | null
          data_pagamento: string | null
          data_vencimento: string
          descricao: string
          dia_vencimento_base: number | null
          empresa_id: number | null
          grupo_parcelamento_id: string | null
          id: string
          is_holding: boolean
          is_recorrente: boolean | null
          lote_pagamento_id: string | null
          mes_competencia: number
          numero_parcela: number | null
          recorrencia_origem_id: string | null
          status: string
          total_parcelas: number | null
          updated_at: string | null
          valor_pago: number | null
          valor_previsto: number
        }
        Insert: {
          ano_competencia: number
          categoria: string
          conta_bancaria_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          descricao: string
          dia_vencimento_base?: number | null
          empresa_id?: number | null
          grupo_parcelamento_id?: string | null
          id?: string
          is_holding?: boolean
          is_recorrente?: boolean | null
          lote_pagamento_id?: string | null
          mes_competencia: number
          numero_parcela?: number | null
          recorrencia_origem_id?: string | null
          status?: string
          total_parcelas?: number | null
          updated_at?: string | null
          valor_pago?: number | null
          valor_previsto?: number
        }
        Update: {
          ano_competencia?: number
          categoria?: string
          conta_bancaria_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string
          dia_vencimento_base?: number | null
          empresa_id?: number | null
          grupo_parcelamento_id?: string | null
          id?: string
          is_holding?: boolean
          is_recorrente?: boolean | null
          lote_pagamento_id?: string | null
          mes_competencia?: number
          numero_parcela?: number | null
          recorrencia_origem_id?: string | null
          status?: string
          total_parcelas?: number | null
          updated_at?: string | null
          valor_pago?: number | null
          valor_previsto?: number
        }
        Relationships: [
          {
            foreignKeyName: "despesas_operacionais_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_operacionais_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_operacionais_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_operacionais_lote_pagamento_id_fkey"
            columns: ["lote_pagamento_id"]
            isOneToOne: false
            referencedRelation: "lotes_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "despesas_operacionais_recorrencia_origem_id_fkey"
            columns: ["recorrencia_origem_id"]
            isOneToOne: false
            referencedRelation: "despesas_operacionais"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          ativo: boolean
          cnpj: string
          codigo: string | null
          created_at: string
          id: number
          nome_fantasia: string
          razao_social: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cnpj: string
          codigo?: string | null
          created_at?: string
          id?: number
          nome_fantasia: string
          razao_social: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cnpj?: string
          codigo?: string | null
          created_at?: string
          id?: number
          nome_fantasia?: string
          razao_social?: string
          updated_at?: string
        }
        Relationships: []
      }
      fatura_recebimentos: {
        Row: {
          conta_bancaria_id: string
          created_at: string | null
          criado_por: string | null
          data_recebimento: string
          fatura_id: string
          id: string
          lote_recebimento_id: string | null
          observacao: string | null
          valor_alocado: number
        }
        Insert: {
          conta_bancaria_id: string
          created_at?: string | null
          criado_por?: string | null
          data_recebimento?: string
          fatura_id: string
          id?: string
          lote_recebimento_id?: string | null
          observacao?: string | null
          valor_alocado: number
        }
        Update: {
          conta_bancaria_id?: string
          created_at?: string | null
          criado_por?: string | null
          data_recebimento?: string
          fatura_id?: string
          id?: string
          lote_recebimento_id?: string | null
          observacao?: string | null
          valor_alocado?: number
        }
        Relationships: [
          {
            foreignKeyName: "fatura_recebimentos_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatura_recebimentos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatura_recebimentos_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "faturas_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fatura_recebimentos_lote_recebimento_id_fkey"
            columns: ["lote_recebimento_id"]
            isOneToOne: false
            referencedRelation: "lotes_recebimento"
            referencedColumns: ["id"]
          },
        ]
      }
      faturas_clientes: {
        Row: {
          ano_competencia: number
          cliente_id: number
          created_at: string | null
          criado_por: string | null
          data_emissao: string
          data_fim_apuracao: string | null
          data_inicio_apuracao: string | null
          data_vencimento: string
          dias_esperados: number | null
          dias_trabalhados: number | null
          empresa_id: number
          faltas_sem_cobertura: number | null
          id: string
          mes_competencia: number
          numero_os: string | null
          numero_periodo: number | null
          observacoes: string | null
          quinzena: number | null
          status: string
          tipo_periodo: string | null
          unidade_id: number
          updated_at: string | null
          valor_faturado: number
          valor_glosa: number | null
          valor_pago: number
        }
        Insert: {
          ano_competencia: number
          cliente_id: number
          created_at?: string | null
          criado_por?: string | null
          data_emissao?: string
          data_fim_apuracao?: string | null
          data_inicio_apuracao?: string | null
          data_vencimento: string
          dias_esperados?: number | null
          dias_trabalhados?: number | null
          empresa_id: number
          faltas_sem_cobertura?: number | null
          id?: string
          mes_competencia: number
          numero_os?: string | null
          numero_periodo?: number | null
          observacoes?: string | null
          quinzena?: number | null
          status?: string
          tipo_periodo?: string | null
          unidade_id: number
          updated_at?: string | null
          valor_faturado?: number
          valor_glosa?: number | null
          valor_pago?: number
        }
        Update: {
          ano_competencia?: number
          cliente_id?: number
          created_at?: string | null
          criado_por?: string | null
          data_emissao?: string
          data_fim_apuracao?: string | null
          data_inicio_apuracao?: string | null
          data_vencimento?: string
          dias_esperados?: number | null
          dias_trabalhados?: number | null
          empresa_id?: number
          faltas_sem_cobertura?: number | null
          id?: string
          mes_competencia?: number
          numero_os?: string | null
          numero_periodo?: number | null
          observacoes?: string | null
          quinzena?: number | null
          status?: string
          tipo_periodo?: string | null
          unidade_id?: number
          updated_at?: string | null
          valor_faturado?: number
          valor_glosa?: number | null
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "faturas_clientes_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_clientes_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_clientes_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_clientes_unidade_id_fkey"
            columns: ["unidade_id"]
            isOneToOne: false
            referencedRelation: "unidades_cliente"
            referencedColumns: ["id"]
          },
        ]
      }
      faturas_fornecedores_convenios: {
        Row: {
          ano_competencia: number
          comprovante_url: string | null
          conta_bancaria_id: string | null
          convenio_id: string
          created_at: string | null
          criado_por: string | null
          data_fim_apuracao: string | null
          data_inicio_apuracao: string | null
          data_pagamento: string | null
          data_vencimento: string
          empresa_id: number | null
          id: string
          lote_pagamento_id: string | null
          mes_competencia: number
          numero_periodo: number
          observacoes: string | null
          quinzena: number | null
          status: string
          tipo_periodo: string
          updated_at: string | null
          valor_pago: number | null
          valor_total_fatura: number
        }
        Insert: {
          ano_competencia: number
          comprovante_url?: string | null
          conta_bancaria_id?: string | null
          convenio_id: string
          created_at?: string | null
          criado_por?: string | null
          data_fim_apuracao?: string | null
          data_inicio_apuracao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          empresa_id?: number | null
          id?: string
          lote_pagamento_id?: string | null
          mes_competencia: number
          numero_periodo?: number
          observacoes?: string | null
          quinzena?: number | null
          status?: string
          tipo_periodo?: string
          updated_at?: string | null
          valor_pago?: number | null
          valor_total_fatura?: number
        }
        Update: {
          ano_competencia?: number
          comprovante_url?: string | null
          conta_bancaria_id?: string | null
          convenio_id?: string
          created_at?: string | null
          criado_por?: string | null
          data_fim_apuracao?: string | null
          data_inicio_apuracao?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          empresa_id?: number | null
          id?: string
          lote_pagamento_id?: string | null
          mes_competencia?: number
          numero_periodo?: number
          observacoes?: string | null
          quinzena?: number | null
          status?: string
          tipo_periodo?: string
          updated_at?: string | null
          valor_pago?: number | null
          valor_total_fatura?: number
        }
        Relationships: [
          {
            foreignKeyName: "faturas_fornecedores_convenios_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_fornecedores_convenios_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_fornecedores_convenios_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_fornecedores_convenios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_fornecedores_convenios_lote_pagamento_id_fkey"
            columns: ["lote_pagamento_id"]
            isOneToOne: false
            referencedRelation: "lotes_pagamento"
            referencedColumns: ["id"]
          },
        ]
      }
      faturas_fornecedores_pagamentos: {
        Row: {
          comprovante_url: string | null
          conta_bancaria_id: string | null
          created_at: string | null
          criado_por: string | null
          data_pagamento: string
          empresa_id: number | null
          fatura_fornecedor_id: string
          id: string
          observacao: string | null
          updated_at: string | null
          valor_pago: number
        }
        Insert: {
          comprovante_url?: string | null
          conta_bancaria_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_pagamento: string
          empresa_id?: number | null
          fatura_fornecedor_id: string
          id?: string
          observacao?: string | null
          updated_at?: string | null
          valor_pago: number
        }
        Update: {
          comprovante_url?: string | null
          conta_bancaria_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_pagamento?: string
          empresa_id?: number | null
          fatura_fornecedor_id?: string
          id?: string
          observacao?: string | null
          updated_at?: string | null
          valor_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "faturas_fornecedores_pagamentos_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_fornecedores_pagamentos_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_fornecedores_pagamentos_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "faturas_fornecedores_pagamentos_fatura_fornecedor_id_fkey"
            columns: ["fatura_fornecedor_id"]
            isOneToOne: false
            referencedRelation: "faturas_fornecedores_convenios"
            referencedColumns: ["id"]
          },
        ]
      }
      fechamentos_caixa_mensal: {
        Row: {
          ano: number
          created_at: string | null
          fechado_por: string | null
          id: string
          mes: number
          saldo_inicial_consolidado: number
          updated_at: string | null
        }
        Insert: {
          ano: number
          created_at?: string | null
          fechado_por?: string | null
          id?: string
          mes: number
          saldo_inicial_consolidado?: number
          updated_at?: string | null
        }
        Update: {
          ano?: number
          created_at?: string | null
          fechado_por?: string | null
          id?: string
          mes?: number
          saldo_inicial_consolidado?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fechamentos_caixa_mensal_fechado_por_fkey"
            columns: ["fechado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      fechamentos_financeiros: {
        Row: {
          ano: number
          colaborador_id: string
          conta_bancaria_id: string | null
          created_at: string | null
          data_fechamento: string | null
          data_pagamento: string | null
          fechado_por: string | null
          id: number
          lote_pagamento_id: string | null
          mes: number
          pago: boolean | null
          resumo_json: Json
          saldo_final: number
        }
        Insert: {
          ano: number
          colaborador_id: string
          conta_bancaria_id?: string | null
          created_at?: string | null
          data_fechamento?: string | null
          data_pagamento?: string | null
          fechado_por?: string | null
          id?: number
          lote_pagamento_id?: string | null
          mes: number
          pago?: boolean | null
          resumo_json: Json
          saldo_final: number
        }
        Update: {
          ano?: number
          colaborador_id?: string
          conta_bancaria_id?: string | null
          created_at?: string | null
          data_fechamento?: string | null
          data_pagamento?: string | null
          fechado_por?: string | null
          id?: number
          lote_pagamento_id?: string | null
          mes?: number
          pago?: boolean | null
          resumo_json?: Json
          saldo_final?: number
        }
        Relationships: [
          {
            foreignKeyName: "fechamentos_financeiros_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fechamentos_financeiros_lote_pagamento_id_fkey"
            columns: ["lote_pagamento_id"]
            isOneToOne: false
            referencedRelation: "lotes_pagamento"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fechamento_colaborador"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_fechamento_fechador"
            columns: ["fechado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      feriados: {
        Row: {
          created_at: string | null
          data: string
          descricao: string | null
          id: number
        }
        Insert: {
          created_at?: string | null
          data: string
          descricao?: string | null
          id?: number
        }
        Update: {
          created_at?: string | null
          data?: string
          descricao?: string | null
          id?: number
        }
        Relationships: []
      }
      itens_equipamentos: {
        Row: {
          ativo: boolean
          categoria_id: number
          created_at: string
          id: number
          nome: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean
          categoria_id: number
          created_at?: string
          id?: number
          nome: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean
          categoria_id?: number
          created_at?: string
          id?: number
          nome?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_itens_equipamentos_categoria"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categoria_itens"
            referencedColumns: ["id"]
          },
        ]
      }
      lancamentos_convenios: {
        Row: {
          centro_custo: string | null
          colaborador_id: string | null
          convenio_id: string | null
          created_at: string | null
          data_lancamento: string
          descricao: string | null
          id: string
          moto_embu: boolean | null
          updated_at: string | null
          valor: number
          veiculo_id: string | null
        }
        Insert: {
          centro_custo?: string | null
          colaborador_id?: string | null
          convenio_id?: string | null
          created_at?: string | null
          data_lancamento?: string
          descricao?: string | null
          id?: string
          moto_embu?: boolean | null
          updated_at?: string | null
          valor: number
          veiculo_id?: string | null
        }
        Update: {
          centro_custo?: string | null
          colaborador_id?: string | null
          convenio_id?: string | null
          created_at?: string | null
          data_lancamento?: string
          descricao?: string | null
          id?: string
          moto_embu?: boolean | null
          updated_at?: string | null
          valor?: number
          veiculo_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lancamentos_convenios_colaborador_id_fkey"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lancamentos_convenios_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_pagamento: {
        Row: {
          conta_bancaria_origem_id: string
          created_at: string | null
          criado_por: string | null
          data_pagamento: string
          id: string
          observacao: string | null
          updated_at: string | null
          valor_total_pago: number
        }
        Insert: {
          conta_bancaria_origem_id: string
          created_at?: string | null
          criado_por?: string | null
          data_pagamento: string
          id?: string
          observacao?: string | null
          updated_at?: string | null
          valor_total_pago: number
        }
        Update: {
          conta_bancaria_origem_id?: string
          created_at?: string | null
          criado_por?: string | null
          data_pagamento?: string
          id?: string
          observacao?: string | null
          updated_at?: string | null
          valor_total_pago?: number
        }
        Relationships: [
          {
            foreignKeyName: "lotes_pagamento_conta_bancaria_origem_id_fkey"
            columns: ["conta_bancaria_origem_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
        ]
      }
      lotes_recebimento: {
        Row: {
          conta_bancaria_destino_id: string
          created_at: string | null
          criado_por: string | null
          data_deposito: string
          id: string
          observacao: string | null
          valor_total_depositado: number
        }
        Insert: {
          conta_bancaria_destino_id: string
          created_at?: string | null
          criado_por?: string | null
          data_deposito?: string
          id?: string
          observacao?: string | null
          valor_total_depositado: number
        }
        Update: {
          conta_bancaria_destino_id?: string
          created_at?: string | null
          criado_por?: string | null
          data_deposito?: string
          id?: string
          observacao?: string | null
          valor_total_depositado?: number
        }
        Relationships: [
          {
            foreignKeyName: "lotes_recebimento_conta_bancaria_destino_id_fkey"
            columns: ["conta_bancaria_destino_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lotes_recebimento_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      categorias_financeiras: {
        Row: {
          afeta_dre: boolean
          ativo: boolean
          codigo: string
          created_at: string
          escopo: string
          grupo_dre: string
          id: string
          is_sistema: boolean
          nome: string
          updated_at: string
        }
        Insert: {
          afeta_dre?: boolean
          ativo?: boolean
          codigo: string
          created_at?: string
          escopo: string
          grupo_dre: string
          id?: string
          is_sistema?: boolean
          nome: string
          updated_at?: string
        }
        Update: {
          afeta_dre?: boolean
          ativo?: boolean
          codigo?: string
          created_at?: string
          escopo?: string
          grupo_dre?: string
          id?: string
          is_sistema?: boolean
          nome?: string
          updated_at?: string
        }
        Relationships: []
      }
      movimentacoes_avulsas: {
        Row: {
          ano_competencia: number
          categoria: string
          comprovante_url: string | null
          conta_bancaria_id: string | null
          conta_contrapartida_id: string | null
          created_at: string | null
          criado_por: string | null
          data_movimentacao: string
          descricao: string
          empresa_id: number
          id: string
          mes_competencia: number
          tipo_movimentacao: string
          transferencia_par_id: string | null
          updated_at: string | null
          valor: number
        }
        Insert: {
          ano_competencia: number
          categoria: string
          comprovante_url?: string | null
          conta_bancaria_id?: string | null
          conta_contrapartida_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_movimentacao?: string
          descricao: string
          empresa_id: number
          id?: string
          mes_competencia: number
          tipo_movimentacao: string
          transferencia_par_id?: string | null
          updated_at?: string | null
          valor: number
        }
        Update: {
          ano_competencia?: number
          categoria?: string
          comprovante_url?: string | null
          conta_bancaria_id?: string | null
          conta_contrapartida_id?: string | null
          created_at?: string | null
          criado_por?: string | null
          data_movimentacao?: string
          descricao?: string
          empresa_id?: number
          id?: string
          mes_competencia?: number
          tipo_movimentacao?: string
          transferencia_par_id?: string | null
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "movimentacoes_avulsas_conta_bancaria_id_fkey"
            columns: ["conta_bancaria_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_avulsas_conta_contrapartida_id_fkey"
            columns: ["conta_contrapartida_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_avulsas_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "movimentacoes_avulsas_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      ocorrencias: {
        Row: {
          colaborador_cliente_id: number | null
          colaborador_id: string
          created_at: string | null
          criado_por: string | null
          data_ocorrencia: string
          id: number
          impacto_financeiro: boolean | null
          observacao: string
          tipo_id: number
          tipo_lancamento: string | null
          updated_at: string | null
          valor: number | null
        }
        Insert: {
          colaborador_cliente_id?: number | null
          colaborador_id: string
          created_at?: string | null
          criado_por?: string | null
          data_ocorrencia: string
          id?: number
          impacto_financeiro?: boolean | null
          observacao: string
          tipo_id: number
          tipo_lancamento?: string | null
          updated_at?: string | null
          valor?: number | null
        }
        Update: {
          colaborador_cliente_id?: number | null
          colaborador_id?: string
          created_at?: string | null
          criado_por?: string | null
          data_ocorrencia?: string
          id?: number
          impacto_financeiro?: boolean | null
          observacao?: string
          tipo_id?: number
          tipo_lancamento?: string | null
          updated_at?: string | null
          valor?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ocorrencia_colaborador"
            columns: ["colaborador_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ocorrencia_criado_por"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ocorrencia_tipo"
            columns: ["tipo_id"]
            isOneToOne: false
            referencedRelation: "tipos_ocorrencia"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ocorrencia_vinculo"
            columns: ["colaborador_cliente_id"]
            isOneToOne: false
            referencedRelation: "colaborador_clientes"
            referencedColumns: ["id"]
          },
        ]
      }
      perfil_permissoes: {
        Row: {
          created_at: string | null
          perfil_id: number
          permissao_id: number
        }
        Insert: {
          created_at?: string | null
          perfil_id: number
          permissao_id: number
        }
        Update: {
          created_at?: string | null
          perfil_id?: number
          permissao_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_perfil_permissoes_perfil"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_perfil_permissoes_permissao"
            columns: ["permissao_id"]
            isOneToOne: false
            referencedRelation: "permissoes"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: number
          nome: string
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: number
          nome: string
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: number
          nome?: string
        }
        Relationships: []
      }
      permissoes: {
        Row: {
          created_at: string | null
          descricao: string | null
          id: number
          modulo: string
          nome_interno: string
        }
        Insert: {
          created_at?: string | null
          descricao?: string | null
          id?: number
          modulo: string
          nome_interno: string
        }
        Update: {
          created_at?: string | null
          descricao?: string | null
          id?: number
          modulo?: string
          nome_interno?: string
        }
        Relationships: []
      }
      registros_pausas: {
        Row: {
          created_at: string | null
          distancia_pausa: number | null
          distancia_trabalho: number | null
          fim_hora: string | null
          fim_km: number | null
          fim_lat: number | null
          fim_lng: number | null
          fim_loc: Json | null
          fim_metadata: Json | null
          id: number
          inicio_hora: string
          inicio_km: number | null
          inicio_lat: number | null
          inicio_lng: number | null
          inicio_loc: Json | null
          inicio_metadata: Json | null
          ponto_id: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          distancia_pausa?: number | null
          distancia_trabalho?: number | null
          fim_hora?: string | null
          fim_km?: number | null
          fim_lat?: number | null
          fim_lng?: number | null
          fim_loc?: Json | null
          fim_metadata?: Json | null
          id?: number
          inicio_hora: string
          inicio_km?: number | null
          inicio_lat?: number | null
          inicio_lng?: number | null
          inicio_loc?: Json | null
          inicio_metadata?: Json | null
          ponto_id: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          distancia_pausa?: number | null
          distancia_trabalho?: number | null
          fim_hora?: string | null
          fim_km?: number | null
          fim_lat?: number | null
          fim_lng?: number | null
          fim_loc?: Json | null
          fim_metadata?: Json | null
          id?: number
          inicio_hora?: string
          inicio_km?: number | null
          inicio_lat?: number | null
          inicio_lng?: number | null
          inicio_loc?: Json | null
          inicio_metadata?: Json | null
          ponto_id?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_pausa_ponto"
            columns: ["ponto_id"]
            isOneToOne: false
            referencedRelation: "registros_ponto"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_pausa_ponto"
            columns: ["ponto_id"]
            isOneToOne: false
            referencedRelation: "v_auditoria_localizacao"
            referencedColumns: ["ponto_id"]
          },
          {
            foreignKeyName: "fk_pausa_ponto"
            columns: ["ponto_id"]
            isOneToOne: false
            referencedRelation: "v_relatorio_mensal_ponto"
            referencedColumns: ["id"]
          },
        ]
      }
      registros_ponto: {
        Row: {
          cliente_id: number | null
          colaborador_cliente_id: number | null
          created_at: string | null
          criado_por: string | null
          data_referencia: string
          detalhes_calculo: Json | null
          empresa_id: number | null
          entrada_hora: string
          entrada_km: number | null
          entrada_lat: number | null
          entrada_lng: number | null
          entrada_loc: Json | null
          entrada_metadata: Json | null
          id: number
          observacao: string | null
          saida_distancia_trabalho: number | null
          saida_hora: string | null
          saida_km: number | null
          saida_lat: number | null
          saida_lng: number | null
          saida_loc: Json | null
          saida_metadata: Json | null
          saldo_minutos: number | null
          status_entrada: string | null
          status_saida: string | null
          updated_at: string | null
          usuario_id: string
        }
        Insert: {
          cliente_id?: number | null
          colaborador_cliente_id?: number | null
          created_at?: string | null
          criado_por?: string | null
          data_referencia: string
          detalhes_calculo?: Json | null
          empresa_id?: number | null
          entrada_hora: string
          entrada_km?: number | null
          entrada_lat?: number | null
          entrada_lng?: number | null
          entrada_loc?: Json | null
          entrada_metadata?: Json | null
          id?: number
          observacao?: string | null
          saida_distancia_trabalho?: number | null
          saida_hora?: string | null
          saida_km?: number | null
          saida_lat?: number | null
          saida_lng?: number | null
          saida_loc?: Json | null
          saida_metadata?: Json | null
          saldo_minutos?: number | null
          status_entrada?: string | null
          status_saida?: string | null
          updated_at?: string | null
          usuario_id: string
        }
        Update: {
          cliente_id?: number | null
          colaborador_cliente_id?: number | null
          created_at?: string | null
          criado_por?: string | null
          data_referencia?: string
          detalhes_calculo?: Json | null
          empresa_id?: number | null
          entrada_hora?: string
          entrada_km?: number | null
          entrada_lat?: number | null
          entrada_lng?: number | null
          entrada_loc?: Json | null
          entrada_metadata?: Json | null
          id?: number
          observacao?: string | null
          saida_distancia_trabalho?: number | null
          saida_hora?: string | null
          saida_km?: number | null
          saida_lat?: number | null
          saida_lng?: number | null
          saida_loc?: Json | null
          saida_metadata?: Json | null
          saldo_minutos?: number | null
          status_entrada?: string | null
          status_saida?: string | null
          updated_at?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_ponto_cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ponto_empresa"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ponto_vinculo"
            columns: ["colaborador_cliente_id"]
            isOneToOne: false
            referencedRelation: "colaborador_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_ponto_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_ponto_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_comments: {
        Row: {
          author_id: string
          content: string
          created_at: string
          id: string
          ticket_id: string
        }
        Insert: {
          author_id: string
          content: string
          created_at?: string
          id?: string
          ticket_id: string
        }
        Update: {
          author_id?: string
          content?: string
          created_at?: string
          id?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_comments_author"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_comments_ticket"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      tickets: {
        Row: {
          attachments: string[]
          author_id: string
          created_at: string
          description: string
          id: string
          priority: string
          status: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          attachments?: string[]
          author_id: string
          created_at?: string
          description: string
          id?: string
          priority?: string
          status?: string
          title: string
          type: string
          updated_at?: string
        }
        Update: {
          attachments?: string[]
          author_id?: string
          created_at?: string
          description?: string
          id?: string
          priority?: string
          status?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_tickets_author"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      tipos_ocorrencia: {
        Row: {
          created_at: string | null
          descricao: string
          id: number
          impacto_financeiro: boolean | null
          tipo_lancamento: string | null
          valor_padrao: number | null
        }
        Insert: {
          created_at?: string | null
          descricao: string
          id?: number
          impacto_financeiro?: boolean | null
          tipo_lancamento?: string | null
          valor_padrao?: number | null
        }
        Update: {
          created_at?: string | null
          descricao?: string
          id?: number
          impacto_financeiro?: boolean | null
          tipo_lancamento?: string | null
          valor_padrao?: number | null
        }
        Relationships: []
      }
      transferencias_intercompany: {
        Row: {
          comprovante_acerto_url: string | null
          created_at: string | null
          data_acerto: string | null
          data_fato_gerador: string
          empresa_credora_id: number
          empresa_devedora_id: number
          fatura_recebimento_id: string | null
          id: string
          observacao: string | null
          status: string
          updated_at: string | null
          valor: number
        }
        Insert: {
          comprovante_acerto_url?: string | null
          created_at?: string | null
          data_acerto?: string | null
          data_fato_gerador?: string
          empresa_credora_id: number
          empresa_devedora_id: number
          fatura_recebimento_id?: string | null
          id?: string
          observacao?: string | null
          status?: string
          updated_at?: string | null
          valor: number
        }
        Update: {
          comprovante_acerto_url?: string | null
          created_at?: string | null
          data_acerto?: string | null
          data_fato_gerador?: string
          empresa_credora_id?: number
          empresa_devedora_id?: number
          fatura_recebimento_id?: string | null
          id?: string
          observacao?: string | null
          status?: string
          updated_at?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transferencias_intercompany_empresa_credora_id_fkey"
            columns: ["empresa_credora_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_intercompany_empresa_devedora_id_fkey"
            columns: ["empresa_devedora_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transferencias_intercompany_fatura_recebimento_id_fkey"
            columns: ["fatura_recebimento_id"]
            isOneToOne: false
            referencedRelation: "fatura_recebimentos"
            referencedColumns: ["id"]
          },
        ]
      }
      unidades_cliente: {
        Row: {
          ativo: boolean
          bairro: string
          cep: string
          cidade: string
          cliente_id: number
          cnpj: string
          complemento: string | null
          conta_bancaria_padrao_id: string | null
          created_at: string
          dia_vencimento_padrao: number
          dia_vencimento_segunda_quinzena: number | null
          empresa_emissora_padrao_id: number | null
          escala_semanal: number[] | null
          estado: string
          id: number
          km_contratados: number | null
          latitude: number | null
          logradouro: string
          longitude: number | null
          nome_unidade: string
          numero: string
          periodicidade: string
          razao_social: string
          tipo_cobranca: string
          updated_at: string | null
          valor_contrato_mensal: number
        }
        Insert: {
          ativo?: boolean
          bairro: string
          cep: string
          cidade: string
          cliente_id: number
          cnpj: string
          complemento?: string | null
          conta_bancaria_padrao_id?: string | null
          created_at?: string
          dia_vencimento_padrao?: number
          dia_vencimento_segunda_quinzena?: number | null
          empresa_emissora_padrao_id?: number | null
          escala_semanal?: number[] | null
          estado: string
          id?: number
          km_contratados?: number | null
          latitude?: number | null
          logradouro: string
          longitude?: number | null
          nome_unidade: string
          numero: string
          periodicidade?: string
          razao_social: string
          tipo_cobranca?: string
          updated_at?: string | null
          valor_contrato_mensal?: number
        }
        Update: {
          ativo?: boolean
          bairro?: string
          cep?: string
          cidade?: string
          cliente_id?: number
          cnpj?: string
          complemento?: string | null
          conta_bancaria_padrao_id?: string | null
          created_at?: string
          dia_vencimento_padrao?: number
          dia_vencimento_segunda_quinzena?: number | null
          empresa_emissora_padrao_id?: number | null
          escala_semanal?: number[] | null
          estado?: string
          id?: number
          km_contratados?: number | null
          latitude?: number | null
          logradouro?: string
          longitude?: number | null
          nome_unidade?: string
          numero?: string
          periodicidade?: string
          razao_social?: string
          tipo_cobranca?: string
          updated_at?: string | null
          valor_contrato_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "fk_unidades_cliente_cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unidades_cliente_conta_bancaria_padrao_id_fkey"
            columns: ["conta_bancaria_padrao_id"]
            isOneToOne: false
            referencedRelation: "contas_bancarias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unidades_cliente_empresa_emissora_padrao_id_fkey"
            columns: ["empresa_emissora_padrao_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      usuarios: {
        Row: {
          chave_pix: string | null
          cnh_categoria: string | null
          cnh_registro: string | null
          cnh_vencimento: string | null
          cnpj: string | null
          cpf: string
          created_at: string | null
          data_inicio: string | null
          data_nascimento: string | null
          email: string
          endereco_completo: string | null
          id: string
          moto_ano: string | null
          moto_cor: string | null
          moto_modelo: string | null
          moto_placa: string | null
          nome_completo: string
          nome_mae: string | null
          perfil_id: number
          rg: string | null
          senha_padrao: boolean | null
          status: string | null
          telefone: string | null
          telefone_recado: string | null
          tipo_chave_pix: string | null
          updated_at: string | null
          valor_mei: number | null
        }
        Insert: {
          chave_pix?: string | null
          cnh_categoria?: string | null
          cnh_registro?: string | null
          cnh_vencimento?: string | null
          cnpj?: string | null
          cpf: string
          created_at?: string | null
          data_inicio?: string | null
          data_nascimento?: string | null
          email: string
          endereco_completo?: string | null
          id: string
          moto_ano?: string | null
          moto_cor?: string | null
          moto_modelo?: string | null
          moto_placa?: string | null
          nome_completo: string
          nome_mae?: string | null
          perfil_id: number
          rg?: string | null
          senha_padrao?: boolean | null
          status?: string | null
          telefone?: string | null
          telefone_recado?: string | null
          tipo_chave_pix?: string | null
          updated_at?: string | null
          valor_mei?: number | null
        }
        Update: {
          chave_pix?: string | null
          cnh_categoria?: string | null
          cnh_registro?: string | null
          cnh_vencimento?: string | null
          cnpj?: string | null
          cpf?: string
          created_at?: string | null
          data_inicio?: string | null
          data_nascimento?: string | null
          email?: string
          endereco_completo?: string | null
          id?: string
          moto_ano?: string | null
          moto_cor?: string | null
          moto_modelo?: string | null
          moto_placa?: string | null
          nome_completo?: string
          nome_mae?: string | null
          perfil_id?: number
          rg?: string | null
          senha_padrao?: boolean | null
          status?: string | null
          telefone?: string | null
          telefone_recado?: string | null
          tipo_chave_pix?: string | null
          updated_at?: string | null
          valor_mei?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "usuarios_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_auditoria_localizacao: {
        Row: {
          cliente_id: number | null
          data_referencia: string | null
          entrada_lat: number | null
          entrada_lng: number | null
          entrada_precisao: string | null
          ponto_id: number | null
          saida_lat: number | null
          saida_lng: number | null
          saida_precisao: string | null
          usuario_id: string | null
        }
        Insert: {
          cliente_id?: number | null
          data_referencia?: string | null
          entrada_lat?: number | null
          entrada_lng?: number | null
          entrada_precisao?: never
          ponto_id?: number | null
          saida_lat?: number | null
          saida_lng?: number | null
          saida_precisao?: never
          usuario_id?: string | null
        }
        Update: {
          cliente_id?: number | null
          data_referencia?: string | null
          entrada_lat?: number | null
          entrada_lng?: number | null
          entrada_precisao?: never
          ponto_id?: number | null
          saida_lat?: number | null
          saida_lng?: number | null
          saida_precisao?: never
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ponto_cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_ponto_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      v_relatorio_mensal_ponto: {
        Row: {
          cliente_id: number | null
          cliente_nome: string | null
          colaborador_cliente_id: number | null
          colaborador_cpf: string | null
          colaborador_nome: string | null
          data_referencia: string | null
          detalhes_calculo: Json | null
          entrada_hora: string | null
          id: number | null
          qtd_pausas: number | null
          saida_hora: string | null
          saldo_minutos: number | null
          status_entrada: string | null
          status_saida: string | null
          tempo_trabalhado_minutos: number | null
          total_km_pausa: number | null
          total_km_trabalho: number | null
          total_pausas_minutos: number | null
          usuario_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_ponto_cliente"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_ponto_vinculo"
            columns: ["colaborador_cliente_id"]
            isOneToOne: false
            referencedRelation: "colaborador_clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registros_ponto_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
