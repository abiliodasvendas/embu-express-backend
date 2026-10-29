import crypto from "crypto";
import { Convenio, LancamentoConvenio, ElegibilidadeConvenioResultado } from "../types/database.js";
import { SalvarBloqueiosColaboradorDTO } from "../schemas/convenio.schema.js";
import { financeiroService } from "./financeiro.service.js";
import { AppError } from "../errors/AppError.js";
import { convenioRepository } from "../repositories/convenio.repository.js";
import { isDavidOuMotoEmbu } from "./convenio-regras.service.js";
import { CADASTRO_STATUS } from "../constants/cadastro.enum.js";

export const convenioService = {
  async listConvenios(ativo?: string) {
    return convenioRepository.list(ativo);
  },

  async getConvenioById(id: string) {
    const convenio = await convenioRepository.getById(id);
    if (!convenio) throw new AppError("Convênio não encontrado", 404);
    return convenio;
  },

  async getLancamentosPorMes(convenioId: string, ano: number, mes: number) {
    const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
    const dataInicioMesStr = `${ano}-${String(mes).padStart(2, "0")}-01`;
    const dataFimMesStr = `${ano}-${String(mes).padStart(2, "0")}-${String(ultimoDiaMes).padStart(2, "0")}`;

    return convenioRepository.listLancamentosPorPeriodo(convenioId, dataInicioMesStr, dataFimMesStr);
  },

  async createConvenio(payload: {
    nome: string;
    ativo?: boolean;
    empresa_id?: number | null;
    conta_bancaria_id?: string | null;
  }) {
    const token = crypto.randomBytes(8).toString("hex");
    return convenioRepository.insert({ ...payload, token });
  },

  async updateConvenio(
    id: string,
    payload: {
      nome?: string;
      ativo?: boolean;
      empresa_id?: number | null;
      conta_bancaria_id?: string | null;
    }
  ) {
    return convenioRepository.update(id, payload);
  },

  async deleteConvenio(id: string) {
    return convenioRepository.delete(id);
  },

  async createLancamentoAdmin(
    convenioId: string,
    payload: Omit<LancamentoConvenio, "id" | "convenio_id" | "created_at" | "updated_at"> & {
      is_parcelado?: boolean;
      quantidade_parcelas?: number;
    }
  ) {
    const { is_parcelado, quantidade_parcelas, ...lancamentoData } = payload;

    if (is_parcelado && quantidade_parcelas && quantidade_parcelas > 1) {
      const lancamentosToInsert = [];
      const baseDate = new Date(lancamentoData.data_lancamento + "T12:00:00Z");

      for (let i = 0; i < quantidade_parcelas; i++) {
        const currentDate = new Date(baseDate);
        const currentMonth = currentDate.getUTCMonth();
        currentDate.setUTCMonth(currentMonth + i);

        if (currentDate.getUTCMonth() !== (currentMonth + i) % 12) {
          currentDate.setUTCDate(0);
        }

        const dataString = currentDate.toISOString().split("T")[0];

        lancamentosToInsert.push({
          ...lancamentoData,
          convenio_id: convenioId,
          data_lancamento: dataString,
          descricao: `${lancamentoData.descricao} (Parcela ${i + 1}/${quantidade_parcelas})`,
        });
      }

      const inserted = await convenioRepository.insertManyLancamentos(lancamentosToInsert);
      return inserted[0];
    }

    return convenioRepository.insertLancamento({ ...lancamentoData, convenio_id: convenioId });
  },

  async updateLancamentoAdmin(
    convenioId: string,
    lancamentoId: string,
    payload: Partial<
      Omit<LancamentoConvenio, "id" | "convenio_id" | "created_at" | "updated_at"> & {
        is_parcelado?: boolean;
        quantidade_parcelas?: number;
      }
    >
  ) {
    const { is_parcelado, quantidade_parcelas, ...updateData } = payload;
    return convenioRepository.updateLancamento(convenioId, lancamentoId, updateData);
  },

  async deleteLancamentoAdmin(convenioId: string, lancamentoId: string) {
    return convenioRepository.deleteLancamento(convenioId, lancamentoId);
  },

  async getBloqueiosColaborador(colaboradorId: string) {
    const bloqueios = await convenioRepository.getBloqueiosColaborador(colaboradorId);
    const bloqueioGeralItem = bloqueios.find((b) => b.convenio_id === null);
    const conveniosBloqueadosIds = bloqueios
      .filter((b) => b.convenio_id !== null)
      .map((b) => b.convenio_id as string);

    return {
      colaborador_id: colaboradorId,
      bloqueio_geral: !!bloqueioGeralItem,
      convenios_bloqueados_ids: conveniosBloqueadosIds,
      motivo: bloqueioGeralItem?.motivo || (bloqueios[0]?.motivo ?? null),
      bloqueios,
    };
  },

  async salvarBloqueiosColaborador(
    colaboradorId: string,
    payload: SalvarBloqueiosColaboradorDTO,
    criadoPor?: string
  ) {
    await convenioRepository.deleteBloqueiosColaborador(colaboradorId);

    if (payload.bloqueio_geral) {
      await convenioRepository.insertBloqueios([
        {
          colaborador_id: colaboradorId,
          convenio_id: null,
          motivo: payload.motivo || null,
          criado_por: criadoPor || null,
        },
      ]);
    } else if (payload.convenios_bloqueados_ids && payload.convenios_bloqueados_ids.length > 0) {
      const rows = payload.convenios_bloqueados_ids.map((cId) => ({
        colaborador_id: colaboradorId,
        convenio_id: cId,
        motivo: payload.motivo || null,
        criado_por: criadoPor || null,
      }));
      await convenioRepository.insertBloqueios(rows);
    }

    return this.getBloqueiosColaborador(colaboradorId);
  },

  async listarTodosBloqueios() {
    return convenioRepository.listTodosBloqueios();
  },

  async verificarElegibilidadeConvenio(
    colaboradorId: string,
    convenioId: string,
    mes?: number,
    ano?: number,
    valorNovoLancamento: number = 0
  ): Promise<ElegibilidadeConvenioResultado> {
    if (!colaboradorId) {
      return { bloqueado: false };
    }

    const usuario = await convenioRepository.getUsuarioStatusEElegibilidade(colaboradorId);
    if (usuario && usuario.status === CADASTRO_STATUS.INATIVO) {
      return {
        bloqueado: true,
        tipo_bloqueio: "MANUAL",
        motivo: "Colaborador inativo na Embu Express.",
      };
    }

    const bloqueios = await convenioRepository.getBloqueiosColaborador(colaboradorId);

    const bloqueioGeral = bloqueios.find((b) => b.convenio_id === null);
    if (bloqueioGeral) {
      return {
        bloqueado: true,
        tipo_bloqueio: "MANUAL",
        motivo:
          bloqueioGeral.motivo ||
          "Colaborador bloqueado para todos os convênios pela Embu Express.",
      };
    }

    const bloqueioEspecifico = bloqueios.find((b) => b.convenio_id === convenioId);
    if (bloqueioEspecifico) {
      return {
        bloqueado: true,
        tipo_bloqueio: "MANUAL",
        motivo:
          bloqueioEspecifico.motivo ||
          "Colaborador com restrição cadastral ativa para este convênio.",
      };
    }

    const agora = new Date();
    const m = mes || agora.getMonth() + 1;
    const a = ano || agora.getFullYear();

    const percentualLimite = await convenioRepository.getPercentualLimiteConvenio();

    if (percentualLimite > 0) {
      try {
        const extrato = await financeiroService.getExtratoMensal(colaboradorId, m, a);
        const totalTurnos = extrato.totais?.total_turnos || 0;
        const totalMei = extrato.totais?.total_mei || 0;
        const creditosAvulsos = extrato.ocorrencias_avulsas?.creditos || 0;
        let rendimentosMes = totalTurnos + totalMei + creditosAvulsos;

        if (rendimentosMes <= 0 && usuario) {
          const valorMeiFixo = Number(usuario.valor_mei) || 0;
          const linksAtivos = (usuario.links || []).filter((l) => !l.data_fim);
          const somaContratos = linksAtivos.reduce(
            (acc: number, l) => acc + (Number(l.valor_contrato) || 0),
            0
          );
          rendimentosMes = valorMeiFixo + somaContratos;
        }

        const tetoLimite = parseFloat(((rendimentosMes * percentualLimite) / 100).toFixed(2));
        const totalGastoMes = (extrato.lancamentos_convenios || []).reduce(
          (acc: number, l: { valor?: number | string | null }) => acc + Number(l.valor || 0),
          0
        );
        const saldoDisponivel = Math.max(0, parseFloat((tetoLimite - totalGastoMes).toFixed(2)));

        if (
          tetoLimite > 0 &&
          (totalGastoMes >= tetoLimite || totalGastoMes + valorNovoLancamento > tetoLimite)
        ) {
          return {
            bloqueado: true,
            tipo_bloqueio: "LIMITE_MARGEM",
            motivo: `Limite mensal de convênio excedido (${percentualLimite}% dos rendimentos). Teto: R$ ${tetoLimite.toFixed(2).replace(".", ",")} | Saldo restante: R$ ${saldoDisponivel.toFixed(2).replace(".", ",")}`,
            teto_limite: tetoLimite,
            saldo_disponivel: saldoDisponivel,
            total_gasto_mes: totalGastoMes,
          };
        }

        return {
          bloqueado: false,
          teto_limite: tetoLimite,
          saldo_disponivel: saldoDisponivel,
          total_gasto_mes: totalGastoMes,
        };
      } catch {
        return { bloqueado: false };
      }
    }

    return { bloqueado: false };
  },

  async getConvenioByToken(token: string) {
    const convenio = await convenioRepository.getByToken(token);
    if (!convenio) throw new AppError("Convênio não encontrado", 404);
    return convenio;
  },

  async getLancamentosPorMesToken(token: string, ano: number, mes: number) {
    const convenio = await this.getConvenioByToken(token);
    return this.getLancamentosPorMes(convenio.id, ano, mes);
  },

  async createLancamentoToken(
    token: string,
    payload: Omit<LancamentoConvenio, "id" | "convenio_id" | "created_at" | "updated_at"> & {
      is_parcelado?: boolean;
      quantidade_parcelas?: number;
    }
  ) {
    const convenio = await this.getConvenioByToken(token);
    if (!convenio.ativo) {
      throw new AppError("Ações de escrita não são permitidas para convênios inativos.", 400);
    }

    const { is_parcelado, quantidade_parcelas, ...lancamentoData } = payload;

    if (!isDavidOuMotoEmbu(lancamentoData) && lancamentoData.colaborador_id) {
      const [anoStr, mesStr] = (lancamentoData.data_lancamento || "").split("-");
      const mesRef = mesStr ? parseInt(mesStr, 10) : undefined;
      const anoRef = anoStr ? parseInt(anoStr, 10) : undefined;

      const elegibilidade = await this.verificarElegibilidadeConvenio(
        lancamentoData.colaborador_id,
        convenio.id,
        mesRef,
        anoRef,
        Number(lancamentoData.valor || 0)
      );

      if (elegibilidade.bloqueado) {
        throw new AppError(
          "Este colaborador está com o convênio suspenso no momento. Não realize o serviço pelo convênio.",
          400
        );
      }
    }

    if (is_parcelado && quantidade_parcelas && quantidade_parcelas > 1) {
      const lancamentosToInsert = [];
      const baseDate = new Date(lancamentoData.data_lancamento + "T12:00:00Z");

      for (let i = 0; i < quantidade_parcelas; i++) {
        const currentDate = new Date(baseDate);
        const currentMonth = currentDate.getUTCMonth();
        currentDate.setUTCMonth(currentMonth + i);

        if (currentDate.getUTCMonth() !== (currentMonth + i) % 12) {
          currentDate.setUTCDate(0);
        }

        const dataString = currentDate.toISOString().split("T")[0];

        lancamentosToInsert.push({
          ...lancamentoData,
          convenio_id: convenio.id,
          data_lancamento: dataString,
          descricao: `${lancamentoData.descricao} (Parcela ${i + 1}/${quantidade_parcelas})`,
        });
      }

      const inserted = await convenioRepository.insertManyLancamentos(lancamentosToInsert);
      return inserted[0];
    }

    return convenioRepository.insertLancamento({ ...lancamentoData, convenio_id: convenio.id });
  },

  async updateLancamentoToken(
    token: string,
    lancamentoId: string,
    payload: Partial<
      Omit<LancamentoConvenio, "id" | "convenio_id" | "created_at" | "updated_at"> & {
        is_parcelado?: boolean;
        quantidade_parcelas?: number;
      }
    >
  ) {
    const convenio = await this.getConvenioByToken(token);
    if (!convenio.ativo) {
      throw new AppError("Ações de escrita não são permitidas para convênios inativos.", 400);
    }

    const { is_parcelado, quantidade_parcelas, ...updateData } = payload;

    if (!isDavidOuMotoEmbu(updateData) && updateData.colaborador_id) {
      const [anoStr, mesStr] = (updateData.data_lancamento || "").split("-");
      const mesRef = mesStr ? parseInt(mesStr, 10) : undefined;
      const anoRef = anoStr ? parseInt(anoStr, 10) : undefined;

      const elegibilidade = await this.verificarElegibilidadeConvenio(
        updateData.colaborador_id,
        convenio.id,
        mesRef,
        anoRef,
        Number(updateData.valor || 0)
      );

      if (elegibilidade.bloqueado) {
        throw new AppError(
          "Este colaborador está com o convênio suspenso no momento. Não realize o serviço pelo convênio.",
          400
        );
      }
    }

    return convenioRepository.updateLancamento(convenio.id, lancamentoId, updateData);
  },

  async deleteLancamentoToken(token: string, lancamentoId: string) {
    const convenio = await this.getConvenioByToken(token);
    if (!convenio.ativo) {
      throw new AppError("Ações de escrita não são permitidas para convênios inativos.", 400);
    }
    return convenioRepository.deleteLancamento(convenio.id, lancamentoId);
  },

  async getColaboradoresAtivosToken(token: string) {
    await this.getConvenioByToken(token);
    return convenioRepository.listColaboradoresAtivos();
  },
};