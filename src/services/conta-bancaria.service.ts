import { AppError } from "../errors/AppError.js";
import { ContaBancaria } from "../types/database.js";
import { z } from "zod";
import { contaBancariaSchema, updateContaBancariaSchema } from "../schemas/conta-bancaria.schema.js";
import { contaBancariaRepository } from "../repositories/conta-bancaria.repository.js";
import { STATUS_DESPESA, TIPO_MOVIMENTACAO_AVULSA } from "../constants/financeiro.enum.js";

type CreateContaBancariaDTO = z.infer<typeof contaBancariaSchema>;
type UpdateContaBancariaDTO = z.infer<typeof updateContaBancariaSchema>;

export const contaBancariaService = {
  async list(empresaId?: number): Promise<ContaBancaria[]> {
    return contaBancariaRepository.list(empresaId);
  },

  async getById(id: string): Promise<ContaBancaria> {
    const data = await contaBancariaRepository.getById(id);
    if (!data) {
      throw new AppError("Conta bancária não encontrada", 404);
    }
    return data;
  },

  async create(data: CreateContaBancariaDTO): Promise<ContaBancaria> {
    return contaBancariaRepository.create(data);
  },

  async update(id: string, data: UpdateContaBancariaDTO): Promise<ContaBancaria> {
    const exists = await contaBancariaRepository.getById(id);
    if (!exists) {
      throw new AppError("Conta bancária não encontrada para atualização", 404);
    }
    return contaBancariaRepository.update(id, data);
  },

  async delete(id: string): Promise<void> {
    const exists = await contaBancariaRepository.getById(id);
    if (!exists) {
      throw new AppError("Conta bancária não encontrada para exclusão", 404);
    }
    await contaBancariaRepository.delete(id);
  },

  async listComSaldos(empresaId?: number, mes?: number, ano?: number) {
    const contas = await contaBancariaRepository.list(empresaId);
    if (!contas || contas.length === 0) return [];

    const mesAlvo = mes || (new Date().getMonth() + 1);
    const anoAlvo = ano || new Date().getFullYear();

    const dados = await contaBancariaRepository.getTransacoesParaSaldos(mesAlvo, anoAlvo);

    const defaultContaPorEmpresa = new Map<number, string>();
    contas.forEach((c) => {
      if (c.empresa_id && !defaultContaPorEmpresa.has(c.empresa_id)) {
        defaultContaPorEmpresa.set(c.empresa_id, c.id);
      }
    });

    return contas.map((conta) => {
      let totalEntradas = 0;
      let totalSaidas = 0;
      let totalTransacoes = 0;

      dados.recebimentos.forEach((rec) => {
        if (rec.conta_bancaria_id === conta.id) {
          totalEntradas += Number(rec.valor_alocado || 0);
          totalTransacoes++;
        }
      });

      dados.movAvulsas.forEach((mov) => {
        if (mov.conta_bancaria_id === conta.id) {
          const val = Number(mov.valor || 0);
          if (mov.tipo_movimentacao === TIPO_MOVIMENTACAO_AVULSA.ENTRADA) {
            totalEntradas += val;
          } else {
            totalSaidas += val;
          }
          totalTransacoes++;
        }
      });

      dados.despesasPagas.forEach((desp) => {
        if (desp.conta_bancaria_id === conta.id) {
          const val = Number(desp.valor_pago || (desp.status === STATUS_DESPESA.PAGO ? desp.valor_previsto : 0) || 0);
          totalSaidas += val;
          totalTransacoes++;
        }
      });

      dados.pagamentosConvenios.forEach((pag) => {
        if (pag.conta_bancaria_id === conta.id) {
          totalSaidas += Number(pag.valor_pago || 0);
          totalTransacoes++;
        }
      });

      const saldoAtual = parseFloat((totalEntradas - totalSaidas).toFixed(2));

      let entradasPrevistas = 0;
      let saidasPrevistas = 0;

      dados.faturasClientesPendentes.forEach((fat) => {
        if (
          (!fat.mes_competencia || fat.mes_competencia === mesAlvo) &&
          (!fat.ano_competencia || fat.ano_competencia === anoAlvo) &&
          conta.empresa_id &&
          fat.empresa_id === conta.empresa_id &&
          defaultContaPorEmpresa.get(conta.empresa_id) === conta.id
        ) {
          const pendente = Math.max(0, Number(fat.valor_faturado || 0) - Number(fat.valor_pago || 0));
          entradasPrevistas += pendente;
        }
      });

      dados.despesasPendentes.forEach((desp) => {
        if (
          (!desp.mes_competencia || desp.mes_competencia === mesAlvo) &&
          (!desp.ano_competencia || desp.ano_competencia === anoAlvo)
        ) {
          const isContaPadraoEmpresa =
            !desp.conta_bancaria_id &&
            conta.empresa_id &&
            desp.empresa_id === conta.empresa_id &&
            defaultContaPorEmpresa.get(conta.empresa_id) === conta.id;

          if (desp.conta_bancaria_id === conta.id || isContaPadraoEmpresa) {
            const pendente = Math.max(0, Number(desp.valor_previsto || 0) - Number(desp.valor_pago || 0));
            saidasPrevistas += pendente;
          }
        }
      });

      dados.conveniosPendentes.forEach((conv) => {
        if (
          (!conv.mes_competencia || conv.mes_competencia === mesAlvo) &&
          (!conv.ano_competencia || conv.ano_competencia === anoAlvo)
        ) {
          const isContaPadraoEmpresa =
            !conv.conta_bancaria_id &&
            conta.empresa_id &&
            conv.empresa_id === conta.empresa_id &&
            defaultContaPorEmpresa.get(conta.empresa_id) === conta.id;

          if (conv.conta_bancaria_id === conta.id || isContaPadraoEmpresa) {
            const pendente = Math.max(0, Number(conv.valor_total_fatura || 0) - Number(conv.valor_pago || 0));
            saidasPrevistas += pendente;
          }
        }
      });

      const saldoProjetado = parseFloat((saldoAtual + entradasPrevistas - saidasPrevistas).toFixed(2));

      return {
        ...conta,
        saldo_atual: saldoAtual,
        saldo_projetado: saldoProjetado,
        total_entradas_realizadas: parseFloat(totalEntradas.toFixed(2)),
        total_saidas_realizadas: parseFloat(totalSaidas.toFixed(2)),
        total_entradas_previstas: parseFloat(entradasPrevistas.toFixed(2)),
        total_saidas_previstas: parseFloat(saidasPrevistas.toFixed(2)),
        total_transacoes: totalTransacoes,
      };
    });
  },
};
