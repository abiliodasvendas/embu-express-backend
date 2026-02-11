export const messages = {
  auth: {
    erro: {
      usuarioNaoEncontrado: "Usuário não encontrado.",
      cadastroPendente: "Cadastro em análise. Aguarde a aprovação.",
      acessoNegado: "Acesso negado. Entre em contato com o suporte.",
      credenciaisInvalidas: "Credenciais inválidas.",
      sessaoExpirada: "Sessão expirada.",
      tokenInvalido: "Token inválido ou expirado.",
      senhaIncorreta: "Senha atual incorreta.",
      atualizarSenha: "Erro ao atualizar senha.",
      tokenAusente: "Token ausente",
      refreshTokenObrigatorio: "Refresh Token é obrigatório.",
      senhaObrigatoria: "Nova senha é obrigatória.",
      cpfSenhaObrigatorios: "CPF e senha são obrigatórios.",
      redefinirSenha: "Erro ao enviar e-mail de redefinição.",
    },
    sucesso: {
      senhaAtualizada: "Senha atualizada com sucesso.",
      logout: "Logout realizado com sucesso.",
      emailRecuperacaoEnviado: "E-mail de recuperação enviado com sucesso.",
    }
  },
  sistema: {
    erro: {
      interno: "Erro interno do servidor.",
      naoAutorizado: "Não autorizado.",
      cors: "Not allowed by CORS",
    }
  },
  usuario: {
    erro: {
      emailObrigatorio: "Email é obrigatório",
      nomeObrigatorio: "Nome completo é obrigatório",
      perfilObrigatorio: "Perfil é obrigatório",
      idObrigatorio: "ID do usuário é obrigatório",
      criarAuth: "Erro ao criar usuário no Auth",
      banco: "Erro no Banco",
      atualizarStatus: "Falha ao atualizar status",
      autoExclusao: "Você não pode excluir seu próprio usuário.",
      autoDesativacao: "Você não pode desativar seu próprio usuário.",
    }
  },
  ponto: {
    erro: {
      buscarTurnos: "Erro ao buscar turnos/links:",
      idPontoObrigatorio: "ID do Ponto é obrigatório",
      pausaAberta: "Já existe uma pausa aberta para este turno.",
      conflitoHorario: "Conflito de horário: Já existe um registro neste turno.",
      ordemInvalida: "A hora de saída não pode ser anterior à hora de entrada.",
      duracaoMinima: "O registro deve ter duração mínima de {min} minuto(s).",
      duracaoMaxima: "O registro excede o limite máximo de {max} horas.",
      sobreposicao: "O horário informado conflita com outro registro existente.",
    }
  },
  cliente: {
    erro: {
      nomeObrigatorio: "Nome fantasia é obrigatório",
      idObrigatorio: "ID do cliente é obrigatório",
      falhaAtivarDesativar: "Falha ao {acao} o cliente.",
    }
  },
  empresa: {
    erro: {
      nomeObrigatorio: "Nome fantasia é obrigatório",
      idObrigatorio: "ID da empresa é obrigatório",
      falhaAtivarDesativar: "Falha ao {acao} a empresa.",
    }
  }
};
