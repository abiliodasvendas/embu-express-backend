import { AppError } from "../errors/AppError.js";
import { ContaBancaria } from "../types/database.js";
import { z } from "zod";
import { contaBancariaSchema, updateContaBancariaSchema } from "../schemas/conta-bancaria.schema.js";
import { contaBancariaRepository } from "../repositories/conta-bancaria.repository.js";
import { folhaContasPagarService } from "./folha-contas-pagar.service.js";
import { STATUS_DESPESA, TIPO_MOVIMENTACAO_AVULSA } from "../constants/financeiro.enum.js";
import { extractDateOnly } from "../utils/utils.js";

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
    const duplicate = await contaBancariaRepository.findDuplicate(
      data.empresa_id,
      data.banco_nome,
      data.agencia,
      data.conta
    );
    if (duplicate) {
      throw new AppError(
        "Já existe uma conta bancária cadastrada com esta agência e número de conta para esta empresa.",
        409
      );
    }
    return contaBancariaRepository.create(data);
  },

  async update(id: string, data: UpdateContaBancariaDTO): Promise<ContaBancaria> {
    const exists = await contaBancariaRepository.getById(id);
    if (!exists) {
      throw new AppError("Conta bancária não encontrada para atualização", 404);
    }
    const duplicate = await contaBancariaRepository.findDuplicate(
      data.empresa_id ?? exists.empresa_id,
      data.banco_nome ?? exists.banco_nome,
      data.agencia !== undefined ? data.agencia : exists.agencia,
      data.conta !== undefined ? data.conta : exists.conta,
      id
    );
    if (duplicate) {
      throw new AppError(
        "Já existe uma conta bancária cadastrada com esta agência e número de conta para esta empresa.",
        409
      );
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

    const ultimoDiaMes = new Date(Date.UTC(anoAlvo, mesAlvo, 0)).getUTCDate();
    const dataInicioMes = `${anoAlvo}-${String(mesAlvo).padStart(2, "0")}-01`;
    const dataFimMes = `${anoAlvo}-${String(mesAlvo).padStart(2, "0")}-${String(ultimoDiaMes).padStart(2, "0")}`;

    const [dados, itensColaboradores] = await Promise.all([
      contaBancariaRepository.getTransacoesParaSaldos(mesAlvo, anoAlvo),
      folhaContasPagarService.listarItensColaboradoresParaContasPagar(
        mesAlvo,
        anoAlvo,
        empresaId
      ),
    ]);

    const defaultContaPorEmpresa = new Map<number, string>();
    contas.forEach((c) => {
      if (c.empresa_id && !defaultContaPorEmpresa.has(c.empresa_id)) {
        defaultContaPorEmpresa.set(c.empresa_id, c.id);
      }
    });

    return contas.map((conta) => {
      let saldoAnterior = 0;
      let totalEntradas = 0;
      let totalSaidas = 0;
      let totalTransacoes = 0;

      const registrarMovimento = (
        valor: number,
        isEntrada: boolean,
        dataStr: string
      ) => {
        if (valor <= 0) return;
        if (dataStr < dataInicioMes) {
          if (isEntrada) {
            saldoAnterior += valor;
          } else {
            saldoAnterior -= valor;
          }
        } else if (dataStr >= dataInicioMes && dataStr <= dataFimMes) {
          if (isEntrada) {
            totalEntradas += valor;
          } else {
            totalSaidas += valor;
          }
          totalTransacoes++;
        }
      };

      dados.recebimentos.forEach((rec) => {
        if (rec.conta_bancaria_id === conta.id) {
          const val = Number(rec.valor_alocado || 0);
          const dataStr =
            extractDateOnly(rec.data_recebimento) ||
            extractDateOnly(rec.created_at) ||
            dataInicioMes;
          registrarMovimento(val, true, dataStr);
        }
      });

      dados.movAvulsas.forEach((mov) => {
        if (mov.conta_bancaria_id === conta.id) {
          const val = Number(mov.valor || 0);
          const isEntrada = mov.tipo_movimentacao === TIPO_MOVIMENTACAO_AVULSA.ENTRADA;
          const dataStr =
            extractDateOnly(mov.data_movimentacao) ||
            extractDateOnly(mov.created_at) ||
            dataInicioMes;
          registrarMovimento(val, isEntrada, dataStr);
        }
      });

      dados.despesasPagas.forEach((desp) => {
        if (desp.conta_bancaria_id === conta.id) {
          const val = Number(
            desp.valor_pago ||
              (desp.status === STATUS_DESPESA.PAGO ? desp.valor_previsto : 0) ||
              0
          );
          const dataStr =
            extractDateOnly(desp.data_pagamento) ||
            extractDateOnly(desp.data_vencimento) ||
            extractDateOnly(desp.created_at) ||
            dataInicioMes;
          registrarMovimento(val, false, dataStr);
        }
      });

      dados.pagamentosConvenios.forEach((pag) => {
        if (pag.conta_bancaria_id === conta.id) {
          const val = Number(pag.valor_pago || 0);
          const dataStr =
            extractDateOnly(pag.data_pagamento) ||
            extractDateOnly(pag.created_at) ||
            dataInicioMes;
          registrarMovimento(val, false, dataStr);
        }
      });

      dados.adiantamentosPagos.forEach((ad) => {
        if (ad.conta_bancaria_id === conta.id) {
          const val = Number(ad.valor || 0);
          const dataStr =
            extractDateOnly(ad.data_pagamento) ||
            extractDateOnly(ad.data_confirmacao) ||
            extractDateOnly(ad.created_at) ||
            dataInicioMes;
          registrarMovimento(val, false, dataStr);
        }
      });

      dados.salariosPagos.forEach((sal) => {
        if (sal.conta_bancaria_id === conta.id) {
          const val = Number(sal.saldo_final || 0);
          const dataStr =
            extractDateOnly(sal.data_pagamento) ||
            extractDateOnly(sal.created_at) ||
            dataInicioMes;
          registrarMovimento(val, false, dataStr);
        }
      });

      const saldoAtual = parseFloat(
        (saldoAnterior + totalEntradas - totalSaidas).toFixed(2)
      );

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

      itensColaboradores.forEach((itemColab) => {
        if (itemColab.status === STATUS_DESPESA.PAGO || itemColab.saldo_pendente <= 0) {
          return;
        }
        const isContaPadraoEmpresa =
          !itemColab.conta_bancaria_id &&
          conta.empresa_id &&
          itemColab.empresa_id === conta.empresa_id &&
          defaultContaPorEmpresa.get(conta.empresa_id) === conta.id;

        if (itemColab.conta_bancaria_id === conta.id || isContaPadraoEmpresa) {
          saidasPrevistas += Number(itemColab.saldo_pendente || 0);
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
