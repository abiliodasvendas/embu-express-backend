import { FilterOptions } from "../constants/filters.enum.js";
import { supabaseAdmin } from "../config/supabase.js";
import { messages } from "../constants/messages.js";
import { AppError } from "../errors/AppError.js";
import { cleanString, onlyNumbers } from "../utils/utils.js";
import { Empresa } from "../types/database.js";
import { empresaSchema, updateEmpresaSchema, listEmpresaSchema } from "../schemas/empresa.schema.js";
import { z } from "zod";

type CreateEmpresaDTO = z.infer<typeof empresaSchema>;
type UpdateEmpresaDTO = z.infer<typeof updateEmpresaSchema>;
type ListEmpresaDTO = z.infer<typeof listEmpresaSchema>;

export const empresaService = {
    async createEmpresa(data: CreateEmpresaDTO): Promise<Empresa> {
        if (!data.nome_fantasia) throw new AppError(messages.empresa.erro.nomeObrigatorio, 400);

        const empresaData = {
            ...data,
            nome_fantasia: cleanString(data.nome_fantasia),
            razao_social: data.razao_social ? cleanString(data.razao_social) : null,
            ativo: data.ativo ?? true,
            cnpj: data.cnpj ? onlyNumbers(data.cnpj) : null,
        };

        const { data: inserted, error } = await supabaseAdmin
            .from("empresas")
            .insert([empresaData])
            .select()
            .single();

        if (error) {
            if (error.code === '23505' && error.message?.toLowerCase().includes('cnpj')) {
                throw new AppError(messages.empresa.erro.cnpjJaExiste, 409);
            }
            throw error;
        }

        return inserted;
    },

    async updateEmpresa(id: number, data: UpdateEmpresaDTO): Promise<Empresa> {
        if (!id) throw new AppError(messages.empresa.erro.idObrigatorio, 400);

        const empresaData: Partial<Empresa> = { ...data };
        if (data.nome_fantasia) empresaData.nome_fantasia = cleanString(data.nome_fantasia);
        if (data.razao_social) empresaData.razao_social = cleanString(data.razao_social);
        if (data.cnpj) empresaData.cnpj = onlyNumbers(data.cnpj);

        const { data: updated, error } = await supabaseAdmin
            .from("empresas")
            .update(empresaData)
            .eq("id", id)
            .select()
            .single();

        if (error) {
            if (error.code === '23505' && error.message?.toLowerCase().includes('cnpj')) {
                throw new AppError(messages.empresa.erro.cnpjJaExiste, 409);
            }
            throw error;
        }

        return updated;
    },

    async deleteEmpresa(id: number): Promise<void> {
        if (!id) throw new AppError(messages.empresa.erro.idObrigatorio, 400);

        const { error } = await supabaseAdmin.from("empresas").delete().eq("id", id);
        if (error) throw error;
    },

    async getEmpresa(id: number): Promise<Empresa> {
        const { data, error } = await supabaseAdmin
            .from("empresas")
            .select("*")
            .eq("id", id)
            .single();
        if (error) throw error;
        return data as Empresa;
    },

    async listEmpresas(filtros?: ListEmpresaDTO): Promise<Empresa[]> {
        let query = supabaseAdmin
            .from("empresas")
            .select("*")
            .order("nome_fantasia", { ascending: true });

        if (filtros?.searchTerm) {
            const cleanSearch = onlyNumbers(filtros.searchTerm);
            let orClause = `nome_fantasia.ilike.%${filtros.searchTerm}%,razao_social.ilike.%${filtros.searchTerm}%`;

            if (cleanSearch) {
                orClause += `,cnpj.ilike.%${cleanSearch}%`;
            }

            query = query.or(orClause);
        }

        if (filtros?.ativo !== undefined && filtros.ativo !== FilterOptions.TODOS) {
            if (filtros.includeId) {
                query = query.or(`ativo.eq.${filtros.ativo === "true"},id.eq.${filtros.includeId}`);
            } else {
                query = query.eq("ativo", filtros.ativo === "true");
            }
        } else if (filtros?.includeId) {
            query = query.eq("id", filtros.includeId);
        }

        const { data, error } = await query;
        if (error) throw error;

        return (data || []) as Empresa[];
    },

    async toggleAtivo(id: number, novoStatus: boolean): Promise<boolean> {
        const { error } = await supabaseAdmin
            .from("empresas")
            .update({ ativo: novoStatus })
            .eq("id", id);

        if (error) throw new AppError(messages.empresa.erro.falhaAtivarDesativar.replace("{acao}", novoStatus ? "ativar" : "desativar"), 500);
        return novoStatus;
    },
};
