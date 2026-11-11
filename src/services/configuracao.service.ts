import { getNowBR } from "../utils/utils.js";
import { configuracaoRepository } from "../repositories/configuracao.repository.js";

export interface Configuracao {
  chave: string;
  valor: string;
  descricao?: string;
  updated_at?: string;
}

export const configuracaoService = {
  async listConfiguracoes(): Promise<Configuracao[]> {
    return configuracaoRepository.list();
  },

  async getConfiguracao(chave: string): Promise<Configuracao | undefined> {
    return configuracaoRepository.getByChave(chave);
  },

  async updateConfiguracao(chave: string, valor: string): Promise<Configuracao | undefined> {
    return configuracaoRepository.updateByChave(chave, valor, getNowBR());
  },
};
