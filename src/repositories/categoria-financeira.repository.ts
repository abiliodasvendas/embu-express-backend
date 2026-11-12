import { supabaseAdmin } from "../config/supabase.js";
import { AppError } from "../errors/AppError.js";
import { CategoriaFinanceira, EscopoCategoriaFinanceira } from "../types/database.js";
import type { TablesInsert, TablesUpdate } from "../types/database.types.js";

export type NovaCategoriaFinanceiraRow = TablesInsert<"categorias_financeiras">;
export type AtualizarCategoriaFinanceiraRow = TablesUpdate<"categorias_financeiras">;

export class CategoriaFinanceiraRepository {
  async findAll(filtros?: {
    escopo?: EscopoCategoriaFinanceira;
    apenas_ativas?: boolean;
  }): Promise<CategoriaFinanceira[]> {
    let query = supabaseAdmin
      .from("categorias_financeiras")
      .select("*")
      .order("is_sistema", { ascending: false })
      .order("nome", { ascending: true });

    if (filtros?.escopo) {
      query = query.eq("escopo", filtros.escopo);
    }

    if (filtros?.apenas_ativas) {
      query = query.eq("ativo", true);
    }

    const { data, error } = await query;
    if (error) {
      throw new AppError(`Erro ao listar categorias financeiras: ${error.message}`, 500);
    }

    return (data ?? []) as unknown as CategoriaFinanceira[];
  }

  async findById(id: string): Promise<CategoriaFinanceira | null> {
    const { data, error } = await supabaseAdmin
      .from("categorias_financeiras")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      throw new AppError(`Erro ao buscar categoria financeira: ${error.message}`, 500);
    }

    return (data as unknown as CategoriaFinanceira) ?? null;
  }

  async findByCodigo(codigo: string): Promise<CategoriaFinanceira | null> {
    const { data, error } = await supabaseAdmin
      .from("categorias_financeiras")
      .select("*")
      .eq("codigo", codigo)
      .maybeSingle();

    if (error) {
      throw new AppError(`Erro ao buscar categoria por código: ${error.message}`, 500);
    }

    return (data as unknown as CategoriaFinanceira) ?? null;
  }

  async create(payload: NovaCategoriaFinanceiraRow): Promise<CategoriaFinanceira> {
    const { data, error } = await supabaseAdmin
      .from("categorias_financeiras")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      throw new AppError(`Erro ao criar categoria financeira: ${error.message}`, 500);
    }

    return data as unknown as CategoriaFinanceira;
  }

  async update(id: string, payload: AtualizarCategoriaFinanceiraRow): Promise<CategoriaFinanceira> {
    const { data, error } = await supabaseAdmin
      .from("categorias_financeiras")
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();

    if (error) {
      throw new AppError(`Erro ao atualizar categoria financeira: ${error.message}`, 500);
    }

    return data as unknown as CategoriaFinanceira;
  }

  async delete(id: string): Promise<void> {
    const { error } = await supabaseAdmin
      .from("categorias_financeiras")
      .delete()
      .eq("id", id);

    if (error) {
      throw new AppError(`Erro ao excluir categoria financeira: ${error.message}`, 500);
    }
  }

  async countUsageByCodigo(): Promise<Map<string, number>> {
    const [movRes, despRes] = await Promise.all([
      supabaseAdmin.from("movimentacoes_avulsas").select("categoria"),
      supabaseAdmin.from("despesas_operacionais").select("categoria"),
    ]);

    const counts = new Map<string, number>();

    for (const row of movRes.data ?? []) {
      counts.set(row.categoria, (counts.get(row.categoria) ?? 0) + 1);
    }

    for (const row of despRes.data ?? []) {
      counts.set(row.categoria, (counts.get(row.categoria) ?? 0) + 1);
    }

    return counts;
  }
}

export const categoriaFinanceiraRepository = new CategoriaFinanceiraRepository();
