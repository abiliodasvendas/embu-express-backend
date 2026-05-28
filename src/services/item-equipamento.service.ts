import { supabaseAdmin } from "../config/supabase.js";
import { CategoriaItem, ItemEquipamento, ColaboradorItem } from "../types/database.js";
import { AppError } from "../errors/AppError.js";

export const categoriaItemService = {
  async listCategorias(): Promise<CategoriaItem[]> {
    const { data, error } = await supabaseAdmin
      .from("categoria_itens")
      .select("*")
      .order("nome", { ascending: true });

    if (error) throw error;
    return data || [];
  },

  async createCategoria(nome: string): Promise<CategoriaItem> {
    const { data, error } = await supabaseAdmin
      .from("categoria_itens")
      .insert([{ nome }])
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new AppError("Já existe uma categoria cadastrada com este nome.", 400);
      }
      throw error;
    }
    return data;
  },

  async updateCategoria(id: number, nome: string): Promise<CategoriaItem> {
    const { data, error } = await supabaseAdmin
      .from("categoria_itens")
      .update({ nome, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new AppError("Já existe uma categoria cadastrada com este nome.", 400);
      }
      throw error;
    }
    return data;
  },

  async deleteCategoria(id: number): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from("categoria_itens")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  },
};

export const itemEquipamentoService = {
  async listItens(): Promise<ItemEquipamento[]> {
    const { data, error } = await supabaseAdmin
      .from("itens_equipamentos")
      .select(`
        *,
        categoria:categoria_itens(*),
        colaborador_itens(count)
      `)
      .order("nome", { ascending: true });

    if (error) throw error;

    const mapped = (data || []).map((item: any) => {
      const total_alocado = item.colaborador_itens?.[0]?.count || 0;
      const { colaborador_itens, ...rest } = item;
      return {
        ...rest,
        total_alocado,
      };
    });

    return mapped;
  },

  async createItem(nome: string, categoriaId: number, ativo: boolean = true): Promise<ItemEquipamento> {
    const { data, error } = await supabaseAdmin
      .from("itens_equipamentos")
      .insert([{ nome, categoria_id: categoriaId, ativo }])
      .select(`
        *,
        categoria:categoria_itens(*)
      `)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new AppError("Já existe um item cadastrado com este nome.", 400);
      }
      throw error;
    }
    return data;
  },

  async updateItem(id: number, nome: string, categoriaId: number, ativo: boolean): Promise<ItemEquipamento> {
    const { data, error } = await supabaseAdmin
      .from("itens_equipamentos")
      .update({ nome, categoria_id: categoriaId, ativo, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select(`
        *,
        categoria:categoria_itens(*)
      `)
      .single();

    if (error) {
      if (error.code === "23505") {
        throw new AppError("Já existe um item cadastrado com este nome.", 400);
      }
      throw error;
    }
    return data;
  },

  async deleteItem(id: number): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from("itens_equipamentos")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  },
};

export const alocacaoItemService = {
  async associarItens(
    colaboradorId: string,
    itensIds: number[],
    criadoPor?: string,
    observacao?: string | null
  ): Promise<ColaboradorItem[]> {
    const alocacoes = itensIds.map((itemId) => ({
      colaborador_id: colaboradorId,
      item_id: itemId,
      quantidade: 1,
      observacao,
      criado_por: criadoPor || null,
    }));

    const { data, error } = await supabaseAdmin
      .from("colaborador_itens")
      .insert(alocacoes)
      .select();

    if (error) throw error;
    return data || [];
  },

  async listAlocadosPorItem(itemId: number): Promise<ColaboradorItem[]> {
    const { data, error } = await supabaseAdmin
      .from("colaborador_itens")
      .select(`
        id,
        colaborador_id,
        item_id,
        quantidade,
        observacao,
        created_at,
        colaborador:usuarios!colaborador_id(id, nome_completo, cpf, status)
      `)
      .eq("item_id", itemId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as any[];
  },

  async listItensColaborador(colaboradorId: string): Promise<ColaboradorItem[]> {
    const { data, error } = await supabaseAdmin
      .from("colaborador_itens")
      .select(`
        id,
        colaborador_id,
        item_id,
        quantidade,
        observacao,
        created_at,
        item:itens_equipamentos(
          id,
          nome,
          categoria:categoria_itens(id, nome)
        )
      `)
      .eq("colaborador_id", colaboradorId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return (data || []) as any[];
  },

  async desassociarItem(id: number): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from("colaborador_itens")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return true;
  },

  async desassociarTodosItensColaborador(colaboradorId: string): Promise<boolean> {
    const { error } = await supabaseAdmin
      .from("colaborador_itens")
      .delete()
      .eq("colaborador_id", colaboradorId);

    if (error) throw error;
    return true;
  },
};
