import { AgingRecebiveisResultado, FaturaCliente } from "../types/database.js";

export function calcularAgingRecebiveis(
  faturas: FaturaCliente[],
  filtros: { mes?: number; ano?: number }
): AgingRecebiveisResultado {
  const hoje = new Date();
  hoje.setUTCHours(0, 0, 0, 0);

  let capitalGiroRetido = 0;
  let totalAVencer = 0;

  let qtdAVencer = 0;
  let valAVencer = 0;
  let qtdAtraso1_15 = 0;
  let valAtraso1_15 = 0;
  let qtdAtraso16_30 = 0;
  let valAtraso16_30 = 0;
  let qtdAtrasoMaior30 = 0;
  let valAtrasoMaior30 = 0;

  const faturasAtrasadas: FaturaCliente[] = [];

  faturas.forEach((fatura) => {
    const valorFaturado = Number(fatura.valor_faturado || 0);
    const valorPago = Number(fatura.valor_pago || 0);
    const saldoAberto = parseFloat(Math.max(0, valorFaturado - valorPago).toFixed(2));

    if (saldoAberto <= 0) return;

    const dataVenc = new Date(`${fatura.data_vencimento}T00:00:00Z`);
    const diffMs = hoje.getTime() - dataVenc.getTime();
    const diasAtraso = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diasAtraso <= 0) {
      qtdAVencer++;
      valAVencer += saldoAberto;
      totalAVencer += saldoAberto;
    } else {
      faturasAtrasadas.push({ ...fatura, dias_atraso: diasAtraso } as unknown as FaturaCliente);
      capitalGiroRetido += saldoAberto;

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

  const totalVencido = parseFloat(capitalGiroRetido.toFixed(2));
  const totalGeralPendente = parseFloat((totalAVencer + totalVencido).toFixed(2));

  return {
    periodo: { mes: filtros.mes, ano: filtros.ano },
    capital_giro_retido_rua: totalVencido,
    total_a_vencer: parseFloat(totalAVencer.toFixed(2)),
    total_vencido: totalVencido,
    total_geral_pendente: totalGeralPendente,
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
}
