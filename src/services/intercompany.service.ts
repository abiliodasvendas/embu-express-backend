import { TransferenciaIntercompany } from "../types/database.js";
import { intercompanyRepository, ListTransferenciasFilters } from "../repositories/intercompany.repository.js";

export const intercompanyService = {
  async listTransferencias(filtros?: ListTransferenciasFilters): Promise<TransferenciaIntercompany[]> {
    return intercompanyRepository.listTransferencias(filtros);
  },

  async getMatrizSaldos() {
    const [pendencias, empresas] = await Promise.all([
      intercompanyRepository.getPendenciasAcerto(),
      intercompanyRepository.getEmpresasAtivas(),
    ]);

    const empresasMap = new Map(empresas.map((e) => [e.id, e]));
    const mapaDividas = new Map<string, number>();

    for (const p of pendencias) {
      const key = `${p.empresa_devedora_id}_${p.empresa_credora_id}`;
      const atual = mapaDividas.get(key) || 0;
      mapaDividas.set(key, atual + Number(p.valor));
    }

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
    return intercompanyRepository.registrarAcerto(payload.transferencia_id, {
      data_acerto: payload.data_acerto,
      comprovante_acerto_url: payload.comprovante_acerto_url,
      observacao: payload.observacao,
    });
  },
};
