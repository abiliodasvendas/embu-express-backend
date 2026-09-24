import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../errors/AppError.js";
import { FaturaCliente, LoteRecebimento, StatusFatura, AgingRecebiveisResultado } from "../types/database.js";
import { z } from "zod";
import { faturaClienteSchema, updateFaturaClienteSchema, loteRecebimentoSchema } from "../schemas/faturamento.schema.js";
import { ROLES } from "../constants/permissions.enum.js";

type CreateFaturaDTO = z.infer<typeof faturaClienteSchema>;
type UpdateFaturaDTO = z.infer<typeof updateFaturaClienteSchema>;
type LoteRecebimentoDTO = z.infer<typeof loteRecebimentoSchema>;

export const faturamentoService = {
  async calcularSugestaoMedicao(clienteId: number, mes: number, ano: number, quinzena: number) {
    const { data: cliente, error: clientError } = await supabaseAdmin
      .from("clientes")
      .select("id, nome_fantasia, tipo_cobranca, valor_base, valor_diaria_glosa")
      .eq("id", clienteId)
      .single();

    if (clientError || !cliente) {
      throw new AppError("Cliente não encontrado", 404);
    }

    const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const dataInicioStr = quinzena === 1
      ? `${ano}-${String(mes).padStart(2, '0')}-01`
      : `${ano}-${String(mes).padStart(2, '0')}-16`;
    const dataFimStr = quinzena === 1
      ? `${ano}-${String(mes).padStart(2, '0')}-15`
      : `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`;

    const { data: perfilMotoboy } = await supabaseAdmin
      .from("perfis")
      .select("id")
      .ilike("nome", ROLES.MOTOBOY)
      .maybeSingle();

    const perfilMotoboyId = perfilMotoboy?.id || 3;

    const { data: pontos } = await supabaseAdmin
      .from("registros_ponto")
      .select("id, usuario_id, data_referencia, colaborador_cliente_id, usuario:usuarios!inner(perfil_id)")
      .eq("cliente_id", clienteId)
      .eq("usuario.perfil_id", perfilMotoboyId)
      .gte("data_referencia", dataInicioStr)
      .lte("data_referencia", dataFimStr);

    const { data: coberturas } = await supabaseAdmin
      .from("alocacoes_temporarias")
      .select("id, reserva_id, data_cobertura, titular_ausente_id")
      .eq("cliente_id", clienteId)
      .gte("data_cobertura", dataInicioStr)
      .lte("data_cobertura", dataFimStr);

    const { data: links } = await supabaseAdmin
      .from("colaborador_clientes")
      .select("id, colaborador_id, horarios:colaborador_cliente_horarios(dia_semana), colaborador:usuarios!inner(perfil_id)")
      .eq("cliente_id", clienteId)
      .eq("colaborador.perfil_id", perfilMotoboyId);

    const diasSet = new Set((pontos || []).map(p => `${p.data_referencia}_${p.usuario_id}`));
    const coberturasSet = new Set((coberturas || []).map(c => `${c.data_cobertura}_${c.reserva_id}`));

    let diasEsperados = 0;
    let faltasSemCobertura = 0;

    const inicioDia = quinzena === 1 ? 1 : 16;
    const fimDia = quinzena === 1 ? 15 : ultimoDiaMes;

    for (let d = inicioDia; d <= fimDia; d++) {
      const dataAtual = new Date(Date.UTC(ano, mes - 1, d));
      const dataStr = dataAtual.toISOString().split("T")[0];
      const diaSemana = dataAtual.getUTCDay();

      (links || []).forEach(link => {
        const temEscala = link.horarios && link.horarios.some((h: { dia_semana: number }) => h.dia_semana === diaSemana);
        if (temEscala) {
          diasEsperados++;
          const trabalhou = diasSet.has(`${dataStr}_${link.colaborador_id}`);
          const teveCobertura = (coberturas || []).some(c => 
            c.data_cobertura === dataStr && (c.titular_ausente_id === link.colaborador_id || (!c.titular_ausente_id))
          );
          if (!trabalhou && !teveCobertura) {
            faltasSemCobertura++;
          }
        }
      });
    }

    const diasTrabalhadosTotal = diasSet.size + coberturasSet.size;
    const tipoCobranca = cliente.tipo_cobranca || "DIARIA_MOTOBOY";
    const valorBase = Number(cliente.valor_base || 0);
    const valorDiariaGlosa = Number(cliente.valor_diaria_glosa || 0);

    let valorSugerido = 0;
    let valorGlosa = 0;

    if (tipoCobranca === "FIXO_MENSAL") {
      const valorQuinzena = valorBase / 2;
      valorGlosa = faltasSemCobertura * valorDiariaGlosa;
      valorSugerido = Math.max(0, valorQuinzena - valorGlosa);
    } else if (tipoCobranca === "DIARIA_MOTOBOY") {
      valorSugerido = diasTrabalhadosTotal * valorBase;
    } else if (tipoCobranca === "TAXA_ENTREGA") {
      valorSugerido = valorBase;
    }

    return {
      cliente_id: clienteId,
      tipo_cobranca: tipoCobranca,
      valor_base: valorBase,
      valor_diaria_glosa: valorDiariaGlosa,
      periodo: { data_inicio: dataInicioStr, data_fim: dataFimStr },
      dias_esperados: diasEsperados,
      dias_trabalhados: diasTrabalhadosTotal,
      faltas_sem_cobertura: faltasSemCobertura,
      valor_glosa: parseFloat(valorGlosa.toFixed(2)),
      valor_sugerido: parseFloat(valorSugerido.toFixed(2)),
    };
  },

  async listFaturas(filtros: {
    mes?: number;
    ano?: number;
    quinzena?: number;
    empresa_id?: number;
    cliente_id?: number;
    status?: StatusFatura;
  }): Promise<FaturaCliente[]> {
    let query = supabaseAdmin
      .from("faturas_clientes")
      .select("*, cliente:clientes(id, nome_fantasia), empresa:empresas(id, nome_fantasia, razao_social, cnpj), recebimentos:fatura_recebimentos(*, conta_bancaria:contas_bancarias(*))")
      .order("data_vencimento", { ascending: false });

    if (filtros.mes) query = query.eq("mes_competencia", filtros.mes);
    if (filtros.ano) query = query.eq("ano_competencia", filtros.ano);
    if (filtros.quinzena) query = query.eq("quinzena", filtros.quinzena);
    if (filtros.empresa_id) query = query.eq("empresa_id", filtros.empresa_id);
    if (filtros.cliente_id) query = query.eq("cliente_id", filtros.cliente_id);
    if (filtros.status) query = query.eq("status", filtros.status);

    const { data, error } = await query;
    if (error) {
      if (error.code === 'PGRST205') {
        return [];
      }
      throw error;
    }
    return data || [];
  },

  async getFaturaById(id: string): Promise<FaturaCliente> {
    const { data, error } = await supabaseAdmin
      .from("faturas_clientes")
      .select("*, cliente:clientes(id, nome_fantasia), empresa:empresas(id, nome_fantasia, razao_social, cnpj), recebimentos:fatura_recebimentos(*, conta_bancaria:contas_bancarias(*))")
      .eq("id", id)
      .single();

    if (error || !data) throw new AppError("Fatura não encontrada", 404);
    return data;
  },

  async createFatura(data: CreateFaturaDTO, criadoPor?: string): Promise<FaturaCliente> {
    const { data: inserted, error } = await supabaseAdmin
      .from("faturas_clientes")
      .insert([{
        ...data,
        criado_por: criadoPor || null,
      }])
      .select("*, cliente:clientes(id, nome_fantasia), empresa:empresas(id, nome_fantasia, razao_social, cnpj)")
      .single();

    if (error) throw error;
    return inserted;
  },

  async updateFatura(id: string, data: UpdateFaturaDTO): Promise<FaturaCliente> {
    const { data: updated, error } = await supabaseAdmin
      .from("faturas_clientes")
      .update(data)
      .eq("id", id)
      .select("*, cliente:clientes(id, nome_fantasia), empresa:empresas(id, nome_fantasia, razao_social, cnpj)")
      .single();

    if (error) throw error;
    return updated;
  },

  async deleteFatura(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("faturas_clientes")
      .delete()
      .eq("id", id);

    if (error) throw error;
  },

  async processarLoteRecebimento(payload: LoteRecebimentoDTO, criadoPor?: string): Promise<LoteRecebimento> {
    const { conta_bancaria_destino_id, data_deposito, valor_total_depositado, comprovante_url, observacao, itens } = payload;

    const { data: contaBancaria, error: contaError } = await supabaseAdmin
      .from("contas_bancarias")
      .select("id, empresa_id, banco_nome")
      .eq("id", conta_bancaria_destino_id)
      .single();

    if (contaError || !contaBancaria) {
      throw new AppError("Conta bancária de destino não encontrada", 404);
    }

    const somaItens = itens.reduce((acc, item) => acc + item.valor_alocado, 0);
    if (Math.abs(somaItens - valor_total_depositado) > 0.05) {
      throw new AppError("A soma dos valores alocados difere do total depositado no lote", 400);
    }

    const { data: lote, error: loteError } = await supabaseAdmin
      .from("lotes_recebimento")
      .insert([{
        conta_bancaria_destino_id,
        data_deposito,
        valor_total_depositado,
        comprovante_url: comprovante_url || null,
        observacao: observacao || null,
        criado_por: criadoPor || null,
      }])
      .select()
      .single();

    if (loteError) throw loteError;

    for (const item of itens) {
      const { data: fatura, error: faturaError } = await supabaseAdmin
        .from("faturas_clientes")
        .select("id, empresa_id, valor_faturado, valor_pago")
        .eq("id", item.fatura_id)
        .single();

      if (faturaError || !fatura) {
        throw new AppError(`Fatura ${item.fatura_id} não encontrada`, 404);
      }

      const { data: recebimento, error: recError } = await supabaseAdmin
        .from("fatura_recebimentos")
        .insert([{
          lote_recebimento_id: lote.id,
          fatura_id: item.fatura_id,
          conta_bancaria_id: conta_bancaria_destino_id,
          data_recebimento: data_deposito,
          valor_alocado: item.valor_alocado,
          observacao: item.observacao || null,
          criado_por: criadoPor || null,
        }])
        .select()
        .single();

      if (recError) throw recError;

      const novoValorPago = parseFloat((Number(fatura.valor_pago || 0) + item.valor_alocado).toFixed(2));
      const novoStatus: StatusFatura = novoValorPago >= Number(fatura.valor_faturado) ? "LIQUIDADA" : "PAGO_PARCIAL";

      await supabaseAdmin
        .from("faturas_clientes")
        .update({
          valor_pago: novoValorPago,
          status: novoStatus,
        })
        .eq("id", fatura.id);

      if (Number(fatura.empresa_id) !== Number(contaBancaria.empresa_id)) {
        await supabaseAdmin
          .from("transferencias_intercompany")
          .insert([{
            fatura_recebimento_id: recebimento.id,
            empresa_credora_id: fatura.empresa_id,
            empresa_devedora_id: contaBancaria.empresa_id,
            valor: item.valor_alocado,
            data_fato_gerador: data_deposito,
            status: "PENDENTE_ACERTO",
            observacao: `Recebimento da fatura ${fatura.id} caiu na conta do banco ${contaBancaria.banco_nome}`,
          }]);
      }
    }

    return lote;
  },

  async getAgingRecebiveis(filtros: {
    mes?: number;
    ano?: number;
    empresa_id?: number;
  }): Promise<AgingRecebiveisResultado> {
    let query = supabaseAdmin
      .from("faturas_clientes")
      .select("*, cliente:clientes(id, nome_fantasia), empresa:empresas(id, nome_fantasia)")
      .neq("status", "CANCELADA")
      .neq("status", "LIQUIDADA");

    if (filtros.mes) query = query.eq("mes_competencia", filtros.mes);
    if (filtros.ano) query = query.eq("ano_competencia", filtros.ano);
    if (filtros.empresa_id) query = query.eq("empresa_id", filtros.empresa_id);

    const { data: faturas, error } = await query;
    if (error) {
      if (error.code === 'PGRST205') {
        return {
          periodo: { mes: filtros.mes, ano: filtros.ano },
          capital_giro_retido_rua: 0,
          total_glosas_periodo: 0,
          total_a_vencer: 0,
          total_vencido: 0,
          total_geral_pendente: 0,
          faixas: [
            { faixa: "A_VENCER", descricao: "A Vencer", quantidade_faturas: 0, valor_total: 0 },
            { faixa: "ATRASO_1_15", descricao: "1 a 15 dias", quantidade_faturas: 0, valor_total: 0 },
            { faixa: "ATRASO_16_30", descricao: "16 a 30 dias", quantidade_faturas: 0, valor_total: 0 },
            { faixa: "ATRASO_MAIOR_30", descricao: "Mais de 30 dias", quantidade_faturas: 0, valor_total: 0 },
          ],
          faturas_atrasadas: [],
        };
      }
      throw error;
    }

    const hoje = new Date();
    hoje.setUTCHours(0, 0, 0, 0);

    let capitalGiroRetido = 0;
    let totalAVencer = 0;
    let totalGlosas = 0;

    let qtdAVencer = 0;
    let valAVencer = 0;
    let qtdAtraso1_15 = 0;
    let valAtraso1_15 = 0;
    let qtdAtraso16_30 = 0;
    let valAtraso16_30 = 0;
    let qtdAtrasoMaior30 = 0;
    let valAtrasoMaior30 = 0;

    const faturasAtrasadas: FaturaCliente[] = [];

    (faturas || []).forEach((fatura) => {
      const valorFaturado = Number(fatura.valor_faturado || 0);
      const valorPago = Number(fatura.valor_pago || 0);
      const saldoAberto = parseFloat(Math.max(0, valorFaturado - valorPago).toFixed(2));
      const glosa = Number(fatura.valor_glosa || 0);
      totalGlosas += glosa;

      if (saldoAberto <= 0) return;

      const dataVenc = new Date(`${fatura.data_vencimento}T00:00:00Z`);
      const diffMs = hoje.getTime() - dataVenc.getTime();
      const diasAtraso = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diasAtraso <= 0) {
        qtdAVencer++;
        valAVencer += saldoAberto;
        totalAVencer += saldoAberto;
      } else {
        capitalGiroRetido += saldoAberto;
        faturasAtrasadas.push(fatura as FaturaCliente);

        if (diasAtraso <= 15) {
          qtdAtraso1_15++;
          valAtraso1_15 += saldoAberto;
        } else if (diasAtraso <= 30) {
          qtdAtraso16_30++;
          valAtraso16_30 += saldoAberto;
        } else {
          qtdAtrasoMaior30++;
          valAtrasoMaior30 += saldoAberto;
        }
      }
    });

    faturasAtrasadas.sort((a, b) => {
      const saldoA = Number(a.valor_faturado) - Number(a.valor_pago || 0);
      const saldoB = Number(b.valor_faturado) - Number(b.valor_pago || 0);
      return saldoB - saldoA;
    });

    return {
      periodo: { mes: filtros.mes, ano: filtros.ano },
      capital_giro_retido_rua: parseFloat(capitalGiroRetido.toFixed(2)),
      total_glosas_periodo: parseFloat(totalGlosas.toFixed(2)),
      total_a_vencer: parseFloat(totalAVencer.toFixed(2)),
      total_vencido: parseFloat(capitalGiroRetido.toFixed(2)),
      total_geral_pendente: parseFloat((totalAVencer + capitalGiroRetido).toFixed(2)),
      faixas: [
        {
          faixa: "A_VENCER",
          descricao: "A Vencer",
          quantidade_faturas: qtdAVencer,
          valor_total: parseFloat(valAVencer.toFixed(2)),
        },
        {
          faixa: "ATRASO_1_15",
          descricao: "1 a 15 dias",
          quantidade_faturas: qtdAtraso1_15,
          valor_total: parseFloat(valAtraso1_15.toFixed(2)),
        },
        {
          faixa: "ATRASO_16_30",
          descricao: "16 a 30 dias",
          quantidade_faturas: qtdAtraso16_30,
          valor_total: parseFloat(valAtraso16_30.toFixed(2)),
        },
        {
          faixa: "ATRASO_MAIOR_30",
          descricao: "Mais de 30 dias",
          quantidade_faturas: qtdAtrasoMaior30,
          valor_total: parseFloat(valAtrasoMaior30.toFixed(2)),
        },
      ],
      faturas_atrasadas: faturasAtrasadas,
    };
  },
};
