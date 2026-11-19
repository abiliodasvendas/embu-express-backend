export interface DreItem {
  descricao: string;
  valor: number;
  percentual?: number;
}

export interface DreCategoriaAgrupada {
  categoria_codigo: string;
  categoria_nome: string;
  total: number;
  quantidade: number;
  itens: DreItem[];
}

export interface DreGrupoDespesas {
  total: number;
  diretas: number;
  rateio_holding: number;
  itens: DreItem[];
  por_categoria: DreCategoriaAgrupada[];
}

interface CategoriaAcumuladaInterna {
  categoria_codigo: string;
  categoria_nome: string;
  total: number;
  itens: DreItem[];
}

export interface AcumuladorDespesaGrupo {
  diretas: number;
  holding: number;
  itens: DreItem[];
  categorias: Map<string, CategoriaAcumuladaInterna>;
}

export function criarAcumuladorGrupo(): AcumuladorDespesaGrupo {
  return {
    diretas: 0,
    holding: 0,
    itens: [],
    categorias: new Map(),
  };
}

function registrarItemNaCategoria(
  grupo: AcumuladorDespesaGrupo,
  categoriaCodigo: string,
  categoriaNome: string,
  item: DreItem
) {
  const atual = grupo.categorias.get(categoriaCodigo);
  if (atual) {
    atual.total += item.valor;
    atual.itens.push(item);
    return;
  }

  grupo.categorias.set(categoriaCodigo, {
    categoria_codigo: categoriaCodigo,
    categoria_nome: categoriaNome,
    total: item.valor,
    itens: [item],
  });
}

export function adicionarLancamentoDiretoGrupo(
  grupo: AcumuladorDespesaGrupo,
  categoriaCodigo: string,
  categoriaNome: string,
  descricao: string,
  valor: number
) {
  const item: DreItem = { descricao, valor };
  grupo.diretas += valor;
  grupo.itens.push(item);
  registrarItemNaCategoria(grupo, categoriaCodigo, categoriaNome, item);
}

export interface AcumularDespesaParams {
  grupo: AcumuladorDespesaGrupo;
  categoriaCodigo: string;
  categoriaNome: string;
  descricao: string;
  valor: number;
  empresaId: number | undefined;
  isDestaEmpresa: boolean;
  isHoldingDespesa: boolean;
  isGeralHolding: boolean;
  shareEmpresa: number;
}

export function acumularDespesaNoGrupo({
  grupo,
  categoriaCodigo,
  categoriaNome,
  descricao,
  valor,
  empresaId,
  isDestaEmpresa,
  isHoldingDespesa,
  isGeralHolding,
  shareEmpresa,
}: AcumularDespesaParams) {
  if (empresaId) {
    if (isDestaEmpresa && !isHoldingDespesa) {
      adicionarLancamentoDiretoGrupo(grupo, categoriaCodigo, categoriaNome, descricao, valor);
    } else if (isGeralHolding) {
      const valorRateado = valor * shareEmpresa;
      const item: DreItem = {
        descricao: `${descricao} (Rateio Holding)`,
        valor: valorRateado,
      };
      grupo.holding += valorRateado;
      grupo.itens.push(item);
      registrarItemNaCategoria(grupo, categoriaCodigo, categoriaNome, item);
    }
    return;
  }

  adicionarLancamentoDiretoGrupo(grupo, categoriaCodigo, categoriaNome, descricao, valor);
}

export function finalizarGrupoDespesas(grupo: AcumuladorDespesaGrupo): DreGrupoDespesas {
  const total = grupo.diretas + grupo.holding;
  const porCategoria: DreCategoriaAgrupada[] = Array.from(grupo.categorias.values())
    .map((cat) => ({
      categoria_codigo: cat.categoria_codigo,
      categoria_nome: cat.categoria_nome,
      total: parseFloat(cat.total.toFixed(2)),
      quantidade: cat.itens.length,
      itens: [...cat.itens]
        .map((item) => ({
          ...item,
          valor: parseFloat(item.valor.toFixed(2)),
        }))
        .sort((a, b) => b.valor - a.valor),
    }))
    .sort((a, b) => b.total - a.total);

  return {
    total: parseFloat(total.toFixed(2)),
    diretas: parseFloat(grupo.diretas.toFixed(2)),
    rateio_holding: parseFloat(grupo.holding.toFixed(2)),
    itens: grupo.itens,
    por_categoria: porCategoria,
  };
}
