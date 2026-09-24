import crypto from "crypto";
import { supabaseAdmin } from "../config/supabase.js";
import { Convenio, LancamentoConvenio, BloqueioConvenio, ElegibilidadeConvenioResultado } from "../types/database.js";
import { SalvarBloqueiosColaboradorDTO } from "../schemas/convenio.schema.js";
import { financeiroService } from "./financeiro.service.js";
import { AppError } from "../errors/AppError.js";

export const convenioService = {
    async listConvenios() {
        const { data, error } = await supabaseAdmin
            .from("convenios")
            .select("*")
            .order("nome", { ascending: true });

        if (error) throw error;
        return data as Convenio[];
    },

    async getConvenioById(id: string) {
        const { data, error } = await supabaseAdmin
            .from("convenios")
            .select("*")
            .eq("id", id)
            .single();

        if (error) throw error;
        return data as Convenio;
    },

    async getLancamentosPorMes(convenioId: string, ano: number, mes: number) {
        const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
        const dataInicioMesStr = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const dataFimMesStr = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`;

        const { data, error } = await supabaseAdmin
            .from("lancamentos_convenios")
            .select(`*, colaborador:usuarios(id, nome_completo, cpf)`)
            .eq("convenio_id", convenioId)
            .gte("data_lancamento", dataInicioMesStr)
            .lte("data_lancamento", dataFimMesStr)
            .order("data_lancamento", { ascending: false })
            .order("created_at", { ascending: false });

        if (error) throw error;
        return data as LancamentoConvenio[];
    },

    async createConvenio(payload: { nome: string; ativo?: boolean }) {
        const token = crypto.randomBytes(8).toString("hex");

        const { data, error } = await supabaseAdmin
            .from("convenios")
            .insert({ ...payload, token })
            .select()
            .single();

        if (error) throw error;
        return data as Convenio;
    },

    async updateConvenio(id: string, payload: { nome?: string; ativo?: boolean }) {
        const { data, error } = await supabaseAdmin
            .from("convenios")
            .update(payload)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        return data as Convenio;
    },

    async deleteConvenio(id: string) {
        const { error } = await supabaseAdmin
            .from("convenios")
            .delete()
            .eq("id", id);

        if (error) throw error;
    },

    async createLancamentoAdmin(convenioId: string, payload: Omit<LancamentoConvenio, "id" | "convenio_id" | "created_at" | "updated_at"> & { is_parcelado?: boolean; quantidade_parcelas?: number }) {
        const { is_parcelado, quantidade_parcelas, ...lancamentoData } = payload;

        if (is_parcelado && quantidade_parcelas && quantidade_parcelas > 1) {
            const lancamentosToInsert = [];
            const baseDate = new Date(lancamentoData.data_lancamento + "T12:00:00Z");

            for (let i = 0; i < quantidade_parcelas; i++) {
                const currentDate = new Date(baseDate);
                const currentMonth = currentDate.getUTCMonth();
                currentDate.setUTCMonth(currentMonth + i);
                
                // Adjust if month overflowed incorrectly
                if (currentDate.getUTCMonth() !== ((currentMonth + i) % 12)) {
                    currentDate.setUTCDate(0); // Rollback to last day of previous month
                }
                
                const dataString = currentDate.toISOString().split("T")[0];

                lancamentosToInsert.push({
                    ...lancamentoData,
                    convenio_id: convenioId,
                    data_lancamento: dataString,
                    descricao: `${lancamentoData.descricao} (Parcela ${i + 1}/${quantidade_parcelas})`
                });
            }

            const { data, error } = await supabaseAdmin
                .from("lancamentos_convenios")
                .insert(lancamentosToInsert)
                .select(`*, colaborador:usuarios(id, nome_completo, cpf)`);

            if (error) throw error;
            return data[0] as LancamentoConvenio;
        }

        const { data, error } = await supabaseAdmin
            .from("lancamentos_convenios")
            .insert({ ...lancamentoData, convenio_id: convenioId })
            .select(`*, colaborador:usuarios(id, nome_completo, cpf)`)
            .single();

        if (error) throw error;
        return data as LancamentoConvenio;
    },

    async updateLancamentoAdmin(convenioId: string, lancamentoId: string, payload: Partial<Omit<LancamentoConvenio, "id" | "convenio_id" | "created_at" | "updated_at"> & { is_parcelado?: boolean; quantidade_parcelas?: number }>) {
        const { is_parcelado, quantidade_parcelas, ...updateData } = payload;

        const { data, error } = await supabaseAdmin
            .from("lancamentos_convenios")
            .update({ ...updateData, updated_at: new Date().toISOString() })
            .eq("id", lancamentoId)
            .eq("convenio_id", convenioId)
            .select(`*, colaborador:usuarios(id, nome_completo, cpf)`)
            .single();

        if (error) throw error;
        return data as LancamentoConvenio;
    },

    async deleteLancamentoAdmin(convenioId: string, lancamentoId: string) {
        const { error } = await supabaseAdmin
            .from("lancamentos_convenios")
            .delete()
            .eq("id", lancamentoId)
            .eq("convenio_id", convenioId);

        if (error) throw error;
    },

    // ---------------------------------------------------------
    // BLOQUEIOS DE CONVÊNIO
    // ---------------------------------------------------------

    async getBloqueiosColaborador(colaboradorId: string) {
        const { data, error } = await supabaseAdmin
            .from("bloqueios_convenios")
            .select(`*, convenio:convenios(id, nome)`)
            .eq("colaborador_id", colaboradorId);

        if (error) throw error;

        const bloqueios = (data || []) as BloqueioConvenio[];
        const bloqueioGeralItem = bloqueios.find((b) => b.convenio_id === null);
        const conveniosBloqueadosIds = bloqueios
            .filter((b) => b.convenio_id !== null)
            .map((b) => b.convenio_id as string);

        return {
            colaborador_id: colaboradorId,
            bloqueio_geral: !!bloqueioGeralItem,
            convenios_bloqueados_ids: conveniosBloqueadosIds,
            motivo: bloqueioGeralItem?.motivo || (bloqueios[0]?.motivo ?? null),
            bloqueios
        };
    },

    async salvarBloqueiosColaborador(colaboradorId: string, payload: SalvarBloqueiosColaboradorDTO, criadoPor?: string) {
        const { error: deleteError } = await supabaseAdmin
            .from("bloqueios_convenios")
            .delete()
            .eq("colaborador_id", colaboradorId);

        if (deleteError) throw deleteError;

        if (payload.bloqueio_geral) {
            const { error: insertError } = await supabaseAdmin
                .from("bloqueios_convenios")
                .insert({
                    colaborador_id: colaboradorId,
                    convenio_id: null,
                    motivo: payload.motivo || null,
                    criado_por: criadoPor || null
                });

            if (insertError) throw insertError;
        } else if (payload.convenios_bloqueados_ids && payload.convenios_bloqueados_ids.length > 0) {
            const rows = payload.convenios_bloqueados_ids.map((cId) => ({
                colaborador_id: colaboradorId,
                convenio_id: cId,
                motivo: payload.motivo || null,
                criado_por: criadoPor || null
            }));

            const { error: insertError } = await supabaseAdmin
                .from("bloqueios_convenios")
                .insert(rows);

            if (insertError) throw insertError;
        }

        return this.getBloqueiosColaborador(colaboradorId);
    },

    async listarTodosBloqueios() {
        const { data, error } = await supabaseAdmin
            .from("bloqueios_convenios")
            .select(`*, colaborador:usuarios!bloqueios_convenios_colaborador_id_fkey(id, nome_completo, cpf), convenio:convenios(id, nome)`)
            .order("criado_em", { ascending: false });

        if (error) throw error;
        return data as BloqueioConvenio[];
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

        const { data: bloqueios, error: bloqueiosError } = await supabaseAdmin
            .from("bloqueios_convenios")
            .select("*")
            .eq("colaborador_id", colaboradorId);

        if (bloqueiosError) throw bloqueiosError;

        const bloqueioGeral = ((bloqueios || []) as BloqueioConvenio[]).find((b) => b.convenio_id === null);
        if (bloqueioGeral) {
            return {
                bloqueado: true,
                tipo_bloqueio: "MANUAL",
                motivo: bloqueioGeral.motivo || "Colaborador bloqueado para todos os convênios pela Embu Express."
            };
        }

        const bloqueioEspecifico = ((bloqueios || []) as BloqueioConvenio[]).find((b) => b.convenio_id === convenioId);
        if (bloqueioEspecifico) {
            return {
                bloqueado: true,
                tipo_bloqueio: "MANUAL",
                motivo: bloqueioEspecifico.motivo || "Colaborador com restrição cadastral ativa para este convênio."
            };
        }

        const agora = new Date();
        const m = mes || (agora.getMonth() + 1);
        const a = ano || agora.getFullYear();

        const { data: configRow } = await supabaseAdmin
            .from("configuracoes_sistema")
            .select("valor")
            .eq("chave", "percentual_limite_convenio")
            .single();

        const percentualLimite = configRow?.valor ? parseFloat(configRow.valor) : 30;

        if (percentualLimite > 0) {
            try {
                const extrato = await financeiroService.getExtratoMensal(colaboradorId, m, a);
                const totalTurnos = extrato.totais?.total_turnos || 0;
                const totalMei = extrato.totais?.total_mei || 0;
                const creditosAvulsos = extrato.ocorrencias_avulsas?.creditos || 0;
                let rendimentosMes = totalTurnos + totalMei + creditosAvulsos;

                if (rendimentosMes <= 0) {
                    const { data: usuarioData } = await supabaseAdmin
                        .from("usuarios")
                        .select("valor_mei, links:colaborador_cliente(valor_contrato, data_fim)")
                        .eq("id", colaboradorId)
                        .single();

                    if (usuarioData) {
                        const valorMeiFixo = Number(usuarioData.valor_mei) || 0;
                        const linksAtivos = ((usuarioData.links || []) as Array<{ data_fim?: string | null; valor_contrato?: number | null }>).filter((l) => !l.data_fim);
                        const somaContratos = linksAtivos.reduce((acc: number, l) => acc + (Number(l.valor_contrato) || 0), 0);
                        rendimentosMes = valorMeiFixo + somaContratos;
                    }
                }

                const tetoLimite = parseFloat(((rendimentosMes * percentualLimite) / 100).toFixed(2));
                const totalGastoMes = ((extrato.lancamentos_convenios || []) as Array<{ valor?: number | string | null }>).reduce((acc: number, l) => acc + Number(l.valor || 0), 0);
                const saldoDisponivel = Math.max(0, parseFloat((tetoLimite - totalGastoMes).toFixed(2)));

                if (tetoLimite > 0 && (totalGastoMes >= tetoLimite || (totalGastoMes + valorNovoLancamento) > tetoLimite)) {
                    return {
                        bloqueado: true,
                        tipo_bloqueio: "LIMITE_MARGEM",
                        motivo: `Limite mensal de convênio excedido (${percentualLimite}% dos rendimentos). Teto: R$ ${tetoLimite.toFixed(2).replace('.', ',')} | Saldo restante: R$ ${saldoDisponivel.toFixed(2).replace('.', ',')}`,
                        teto_limite: tetoLimite,
                        saldo_disponivel: saldoDisponivel,
                        total_gasto_mes: totalGastoMes
                    };
                }

                return {
                    bloqueado: false,
                    teto_limite: tetoLimite,
                    saldo_disponivel: saldoDisponivel,
                    total_gasto_mes: totalGastoMes
                };
            } catch {
                return { bloqueado: false };
            }
        }

        return { bloqueado: false };
    },

    async getConvenioByToken(token: string) {
        const { data, error } = await supabaseAdmin
            .from("convenios")
            .select("*")
            .eq("token", token)
            .single();

        if (error || !data) throw new Error("Convênio não encontrado");
        return data as Convenio;
    },

    async getLancamentosPorMesToken(token: string, ano: number, mes: number) {
        const convenio = await this.getConvenioByToken(token);

        const ultimoDiaMes = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
        const dataInicioMesStr = `${ano}-${String(mes).padStart(2, '0')}-01`;
        const dataFimMesStr = `${ano}-${String(mes).padStart(2, '0')}-${String(ultimoDiaMes).padStart(2, '0')}`;

        const { data, error } = await supabaseAdmin
            .from("lancamentos_convenios")
            .select(`*, colaborador:usuarios(id, nome_completo, cpf)`)
            .eq("convenio_id", convenio.id)
            .gte("data_lancamento", dataInicioMesStr)
            .lte("data_lancamento", dataFimMesStr)
            .order("data_lancamento", { ascending: false })
            .order("created_at", { ascending: false });

        if (error) throw error;
        return data as LancamentoConvenio[];
    },

    async createLancamentoToken(token: string, payload: Omit<LancamentoConvenio, "id" | "convenio_id" | "created_at" | "updated_at"> & { is_parcelado?: boolean; quantidade_parcelas?: number }) {
        const convenio = await this.getConvenioByToken(token);
        if (!convenio.ativo) {
            throw new AppError("Ações de escrita não são permitidas para convênios inativos.", 400);
        }

        const { is_parcelado, quantidade_parcelas, ...lancamentoData } = payload;

        if (!lancamentoData.moto_embu && lancamentoData.colaborador_id) {
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
                throw new AppError("Este colaborador está com o convênio suspenso no momento. Não realize o serviço pelo convênio.", 400);
            }
        }

        if (is_parcelado && quantidade_parcelas && quantidade_parcelas > 1) {
            const lancamentosToInsert = [];
            const baseDate = new Date(lancamentoData.data_lancamento + "T12:00:00Z");

            for (let i = 0; i < quantidade_parcelas; i++) {
                const currentDate = new Date(baseDate);
                const currentMonth = currentDate.getUTCMonth();
                currentDate.setUTCMonth(currentMonth + i);
                
                if (currentDate.getUTCMonth() !== ((currentMonth + i) % 12)) {
                    currentDate.setUTCDate(0);
                }
                
                const dataString = currentDate.toISOString().split("T")[0];

                lancamentosToInsert.push({
                    ...lancamentoData,
                    convenio_id: convenio.id,
                    data_lancamento: dataString,
                    descricao: `${lancamentoData.descricao} (Parcela ${i + 1}/${quantidade_parcelas})`
                });
            }

            const { data, error } = await supabaseAdmin
                .from("lancamentos_convenios")
                .insert(lancamentosToInsert)
                .select(`*, colaborador:usuarios(id, nome_completo, cpf)`);

            if (error) throw error;
            return data[0] as LancamentoConvenio;
        }

        const { data, error } = await supabaseAdmin
            .from("lancamentos_convenios")
            .insert({ ...lancamentoData, convenio_id: convenio.id })
            .select(`*, colaborador:usuarios(id, nome_completo, cpf)`)
            .single();

        if (error) throw error;
        return data as LancamentoConvenio;
    },

    async updateLancamentoToken(token: string, lancamentoId: string, payload: Partial<Omit<LancamentoConvenio, "id" | "convenio_id" | "created_at" | "updated_at"> & { is_parcelado?: boolean; quantidade_parcelas?: number }>) {
        const convenio = await this.getConvenioByToken(token);
        if (!convenio.ativo) {
            throw new AppError("Ações de escrita não são permitidas para convênios inativos.", 400);
        }

        const { is_parcelado, quantidade_parcelas, ...updateData } = payload;

        if (!updateData.moto_embu && updateData.colaborador_id) {
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
                throw new AppError("Este colaborador está com o convênio suspenso no momento. Não realize o serviço pelo convênio.", 400);
            }
        }

        const { data, error } = await supabaseAdmin
            .from("lancamentos_convenios")
            .update({ ...updateData, updated_at: new Date().toISOString() })
            .eq("id", lancamentoId)
            .eq("convenio_id", convenio.id)
            .select(`*, colaborador:usuarios(id, nome_completo, cpf)`)
            .single();

        if (error) throw error;
        return data as LancamentoConvenio;
    },

    async deleteLancamentoToken(token: string, lancamentoId: string) {
        const convenio = await this.getConvenioByToken(token);
        if (!convenio.ativo) {
            throw new AppError("Ações de escrita não são permitidas para convênios inativos.", 400);
        }

        const { error } = await supabaseAdmin
            .from("lancamentos_convenios")
            .delete()
            .eq("id", lancamentoId)
            .eq("convenio_id", convenio.id);

        if (error) throw error;
    },

    async getColaboradoresAtivosToken(token: string) {
        const convenio = await this.getConvenioByToken(token);

        const { data: usuarios, error } = await supabaseAdmin
            .from("usuarios")
            .select("id, nome_completo")
            .eq("status", "ATIVO")
            .order("nome_completo", { ascending: true });

        if (error) throw error;
        if (!usuarios || usuarios.length === 0) return [];

        const hoje = new Date();
        const mesAtual = hoje.getMonth() + 1;
        const anoAtual = hoje.getFullYear();

        const { data: bloqueios } = await supabaseAdmin
            .from("bloqueios_convenios")
            .select("*");

        const bloqueiosMap = new Map<string, { bloqueado: boolean }>();
        ((bloqueios || []) as BloqueioConvenio[]).forEach((b) => {
            if (b.convenio_id === null || b.convenio_id === convenio.id) {
                bloqueiosMap.set(b.colaborador_id, {
                    bloqueado: true
                });
            }
        });

        const mensagemBloqueio = "Este colaborador está com o convênio suspenso no momento. Não realize o serviço pelo convênio.";

        const resultado = await Promise.all(
            usuarios.map(async (u) => {
                const manual = bloqueiosMap.get(u.id);
                if (manual) {
                    return {
                        id: u.id,
                        nome_completo: u.nome_completo,
                        bloqueado: true,
                        motivo_bloqueio: mensagemBloqueio
                    };
                }

                try {
                    const eleg = await this.verificarElegibilidadeConvenio(u.id, convenio.id, mesAtual, anoAtual, 0);
                    return {
                        id: u.id,
                        nome_completo: u.nome_completo,
                        bloqueado: eleg.bloqueado,
                        motivo_bloqueio: eleg.bloqueado ? mensagemBloqueio : undefined,
                        saldo_disponivel: eleg.saldo_disponivel
                    };
                } catch {
                    return {
                        id: u.id,
                        nome_completo: u.nome_completo,
                        bloqueado: false
                    };
                }
            })
        );

        return resultado;
    }
};
