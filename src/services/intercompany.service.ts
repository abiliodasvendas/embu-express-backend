import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../errors/AppError.js";
import { TransferenciaIntercompany } from "../types/database.js";

export const intercompanyService = {
  async listTransferencias(filtros?: {
    status?: "PENDENTE_ACERTO" | "COMPENSADO";
    empresaCredoraId?: number;
    empresaDevedoraId?: number;
  }): Promise<TransferenciaIntercompany[]> {
    let query = supabaseAdmin
      .from("transferencias_intercompany")
      .select("*, empresa_credora:empresas!empresa_credora_id(id, nome_fantasia, razao_social, cnpj), empresa_devedora:empresas!empresa_devedora_id(id, nome_fantasia, razao_social, cnpj)")
      .order("data_fato_gerador", { ascending: false });

    if (filtros?.status) query = query.eq("status", filtros.status);
    if (filtros?.empresaCredoraId) query = query.eq("empresa_credora_id", filtros.empresaCredoraId);
    if (filtros?.empresaDevedoraId) query = query.eq("empresa_devedora_id", filtros.empresaDevedoraId);

    const { data, error } = await query;
    if (error) {
      if (error.code === 'PGRST205') {
        return [];
      }
      throw error;
    }
    return data || [];
  },

  async getMatrizSaldos() {
    const { data: pendencias, error } = await supabaseAdmin
      .from("transferencias_intercompany")
      .select("empresa_credora_id, empresa_devedora_id, valor")
      .eq("status", "PENDENTE_ACERTO");

    if (error) {
      if (error.code === 'PGRST205') {
        return [];
      }
      throw error;
    }

    const { data: empresas } = await supabaseAdmin
      .from("empresas")
      .select("id, nome_fantasia, codigo")
      .eq("ativo", true);

    const empresasMap = new Map((empresas || []).map(e => [e.id, e]));

    const mapaDividas = new Map<string, number>();

    (pendencias || []).forEach(p => {
      const key = `${p.empresa_devedora_id}_${p.empresa_credora_id}`;
      const atual = mapaDividas.get(key) || 0;
      mapaDividas.set(key, atual + Number(p.valor));
    });

    const paresProcessados = new Set<string>();
    const matrizCompensada: Array<{
      empresa_devedora: { id: number; nome_fantasia: string; codigo?: string | null };
      empresa_credora: { id: number; nome_fantasia: string; codigo?: string | null };
      saldo_devedor_liquido: number;
    }> = [];

    mapaDividas.forEach((_, key) => {
      const [devStr, credStr] = key.split("_");
      const idA = Number(devStr);
      const idB = Number(credStr);

      const parKey = idA < idB ? `${idA}_${idB}` : `${idB}_${idA}`;
      if (paresProcessados.has(parKey)) return;
      paresProcessados.add(parKey);

      const dividaAparaB = mapaDividas.get(`${idA}_${idB}`) || 0;
      const dividaBparaA = mapaDividas.get(`${idB}_${idA}`) || 0;

      const saldoLiquido = dividaAparaB - dividaBparaA;

      if (saldoLiquido > 0) {
        const empDev = empresasMap.get(idA);
        const empCred = empresasMap.get(idB);
        if (empDev && empCred) {
          matrizCompensada.push({
            empresa_devedora: empDev,
            empresa_credora: empCred,
            saldo_devedor_liquido: parseFloat(saldoLiquido.toFixed(2)),
          });
        }
      } else if (saldoLiquido < 0) {
        const empDev = empresasMap.get(idB);
        const empCred = empresasMap.get(idA);
        if (empDev && empCred) {
          matrizCompensada.push({
            empresa_devedora: empDev,
            empresa_credora: empCred,
            saldo_devedor_liquido: parseFloat(Math.abs(saldoLiquido).toFixed(2)),
          });
        }
      }
    });

    return matrizCompensada;
  },

  async registrarAcerto(payload: {
    transferencia_id: string;
    data_acerto: string;
    comprovante_acerto_url?: string | null;
    observacao?: string | null;
  }) {
    const { data: updated, error } = await supabaseAdmin
      .from("transferencias_intercompany")
      .update({
        status: "COMPENSADO",
        data_acerto: payload.data_acerto,
        comprovante_acerto_url: payload.comprovante_acerto_url || null,
        observacao: payload.observacao || null,
      })
      .eq("id", payload.transferencia_id)
      .select()
      .single();

    if (error) throw error;
    return updated;
  },
};
