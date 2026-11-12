import {
  CATEGORIA_MOVIMENTACAO_AVULSA,
  GRUPO_DRE_CATEGORIA,
} from "../constants/financeiro.enum.js";
import { AppError } from "../errors/AppError.js";
import { categoriaFinanceiraRepository } from "../repositories/categoria-financeira.repository.js";
import {
  CreateCategoriaFinanceiraDTO,
  ListCategoriasFinanceirasQueryDTO,
  UpdateCategoriaFinanceiraDTO,
} from "../schemas/categoria-financeira.schema.js";
import { CategoriaFinanceira } from "../types/database.js";

function gerarCodigoSlug(nome: string): string {
  const normalizado = nome
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);

  return normalizado || `CAT_${Date.now()}`;
}

export class CategoriaFinanceiraService {
  async list(filtros?: ListCategoriasFinanceirasQueryDTO): Promise<CategoriaFinanceira[]> {
    const [categorias, usageMap] = await Promise.all([
      categoriaFinanceiraRepository.findAll(filtros),
      categoriaFinanceiraRepository.countUsageByCodigo(),
    ]);

    return categorias.map((cat) => ({
      ...cat,
      vinculos_count: usageMap.get(cat.codigo) ?? 0,
    }));
  }

  async create(dto: CreateCategoriaFinanceiraDTO): Promise<CategoriaFinanceira> {
    const baseSlug = gerarCodigoSlug(dto.nome);
    let codigoFinal = baseSlug;
    let sufixo = 2;

    while (await categoriaFinanceiraRepository.findByCodigo(codigoFinal)) {
      codigoFinal = `${baseSlug}_${sufixo}`;
      sufixo++;
    }

    const afetaDre = dto.grupo_dre !== GRUPO_DRE_CATEGORIA.NAO_AFETA_DRE;

    const criada = await categoriaFinanceiraRepository.create({
      codigo: codigoFinal,
      nome: dto.nome.trim(),
      escopo: dto.escopo,
      grupo_dre: dto.grupo_dre,
      afeta_dre: afetaDre,
      is_sistema: false,
      ativo: true,
    });

    return {
      ...criada,
      vinculos_count: 0,
    };
  }

  async update(id: string, dto: UpdateCategoriaFinanceiraDTO): Promise<CategoriaFinanceira> {
    const existente = await categoriaFinanceiraRepository.findById(id);
    if (!existente) {
      throw new AppError("Categoria financeira não encontrada.", 404);
    }

    if (
      existente.codigo === CATEGORIA_MOVIMENTACAO_AVULSA.TRANSFERENCIA_ENTRE_CONTAS &&
      dto.grupo_dre &&
      dto.grupo_dre !== GRUPO_DRE_CATEGORIA.NAO_AFETA_DRE
    ) {
      throw new AppError(
        "A categoria de Transferência entre Contas deve permanecer neutra no DRE.",
        400
      );
    }

    const grupoDreFinal = dto.grupo_dre ?? existente.grupo_dre;
    const afetaDreFinal = grupoDreFinal !== GRUPO_DRE_CATEGORIA.NAO_AFETA_DRE;

    const atualizada = await categoriaFinanceiraRepository.update(id, {
      ...(dto.nome !== undefined ? { nome: dto.nome.trim() } : {}),
      ...(dto.grupo_dre !== undefined
        ? { grupo_dre: dto.grupo_dre, afeta_dre: afetaDreFinal }
        : {}),
      ...(dto.ativo !== undefined ? { ativo: dto.ativo } : {}),
    });

    const usageMap = await categoriaFinanceiraRepository.countUsageByCodigo();
    return {
      ...atualizada,
      vinculos_count: usageMap.get(atualizada.codigo) ?? 0,
    };
  }

  async delete(id: string): Promise<void> {
    const existente = await categoriaFinanceiraRepository.findById(id);
    if (!existente) {
      throw new AppError("Categoria financeira não encontrada.", 404);
    }

    if (existente.is_sistema) {
      throw new AppError(
        "Categorias padrão do sistema não podem ser excluídas permanentemente. Você pode editar o nome ou inativá-la.",
        400
      );
    }

    const usageMap = await categoriaFinanceiraRepository.countUsageByCodigo();
    const vinculos = usageMap.get(existente.codigo) ?? 0;

    if (vinculos > 0) {
      throw new AppError(
        `Esta categoria possui ${vinculos} lançamento(s) vinculado(s) e não pode ser excluída. Inative-a ou edite seu nome.`,
        400
      );
    }

    await categoriaFinanceiraRepository.delete(id);
  }
}

export const categoriaFinanceiraService = new CategoriaFinanceiraService();
