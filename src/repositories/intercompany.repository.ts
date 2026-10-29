import { supabaseAdmin } from "../config/supabase.js";
import { TransferenciaIntercompany } from "../types/database.js";
import { STATUS_INTERCOMPANY } from "../constants/financeiro.enum.js";

export interface ListTransferenciasFilters {
  status?: typeof STATUS_INTERCOMPANY[keyof typeof STATUS_INTERCOMPANY];
  empresaCredoraId?: number;
  empresaDevedoraId?: number;
}

export const intercompanyRepository = {
  async listTransferencias(filtros?: ListTransferenciasFilters): Promise<TransferenciaIntercompany[]> {
    let query = supabaseAdmin
      .from("transferencias_intercompany")
      .select("*, empresa_credora:empresas!empresa_credora_id(id, nome_fantasia, razao_social, cnpj), empresa_devedora:empresas!empresa_devedora_id(id, nome_fantasia, razao_social, cnpj)")
      .order("data_fato_gerador", { ascending: false });

    if (filtros?.status) query = query.eq("status", filtros.status);
    if (filtros?.empresaCredoraId) query = query.eq("empresa_credora_id", filtros.empresaCredoraId);
    if (filtros?.empresaDevedoraId) query = query.eq("empresa_devedora_id", filtros.empresaDevedoraId);

    const { data, error } = await query;
    if (error) {
      if (error.code === "PGRST205") {
        return [];
      }
      throw error;
    }
    return (data || []) as TransferenciaIntercompany[];
  },

  async getPendenciasAcerto(): Promise<Array<{ empresa_credora_id: number; empresa_devedora_id: number; valor: number }>> {
    const { data, error } = await supabaseAdmin
      .from("transferencias_intercompany")
      .select("empresa_credora_id, empresa_devedora_id, valor")
      .eq("status", STATUS_INTERCOMPANY.PENDENTE_ACERTO);

    if (error) {
      if (error.code === "PGRST205") {
        return [];
      }
      throw error;
    }
    return (data || []) as Array<{ empresa_credora_id: number; empresa_devedora_id: number; valor: number }>;
  },

  async getEmpresasAtivas(): Promise<Array<{ id: number; nome_fantasia: string; codigo?: string | null }>> {
    const { data, error } = await supabaseAdmin
      .from("empresas")
      .select("id, nome_fantasia, codigo")
      .eq("ativo", true);

    if (error) throw error;
    return (data || []) as Array<{ id: number; nome_fantasia: string; codigo?: string | null }>;
  },

  async registrarAcerto(
    transferenciaId: string,
    payload: {
      data_acerto: string;
      comprovante_acerto_url?: string | null;
      observacao?: string | null;
    }
  ): Promise<TransferenciaIntercompany> {
    const { data, error } = await supabaseAdmin
      .from("transferencias_intercompany")
      .update({
        status: STATUS_INTERCOMPANY.COMPENSADO,
        data_acerto: payload.data_acerto,
        comprovante_acerto_url: payload.comprovante_acerto_url || null,
        observacao: payload.observacao || null,
      })
      .eq("id", transferenciaId)
      .select()
      .single();

    if (error) throw error;
    return data as TransferenciaIntercompany;
  },
};
