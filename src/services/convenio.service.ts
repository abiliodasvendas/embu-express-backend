import crypto from "crypto";
import { supabaseAdmin } from "../config/supabase.js";
import { Convenio, LancamentoConvenio } from "../types/database.js";
import { AppError } from "../errors/AppError.js";

export const convenioService = {
    // ---------------------------------------------------------
    // ADMIN (Embu)
    // ---------------------------------------------------------

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
        // Gerar um token fixo de 8 a 16 caracteres para a URL
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
    // PÚBLICO (Parceiro via Token)
    // ---------------------------------------------------------

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
        await this.getConvenioByToken(token);

        const { data, error } = await supabaseAdmin
            .from("usuarios")
            .select("id, nome_completo")
            .eq("status", "ATIVO")
            .order("nome_completo", { ascending: true });

        if (error) throw error;
        return data;
    }
};
