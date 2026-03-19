export const messages = {
  auth: {
    erro: {
      usuarioNaoEncontrado: "CPF não encontrado.",
      cadastroPendente: "Seu cadastro ainda não foi aprovado.",
      contaInativa: "Sua conta está inativa. Entre em contato com o suporte.",
      acessoNegado: "Acesso negado.",
      credenciaisInvalidas: "Senha inválida.",
      sessaoExpirada: "Sessão expirada.",
      tokenInvalido: "Token inválido ou expirado.",
      senhaIncorreta: "Senha atual incorreta.",
      atualizarSenha: "Erro ao atualizar senha.",
      tokenAusente: "Token ausente",
      refreshTokenObrigatorio: "Refresh Token é obrigatório.",
      senhaObrigatoria: "Nova senha é obrigatória.",
      cpfSenhaObrigatorios: "CPF e senha são obrigatórios.",
      redefinirSenha: "Erro ao enviar e-mail de redefinição.",
      perfilNaoEncontrado: "Perfil não encontrado no sistema.",
      sessaoFalha: "Senha atualizada, mas falha ao obter nova sessão. Faça o login novamente.",
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
      cpfJaExiste: "Este CPF já está cadastrado no sistema.",
      emailJaExiste: "Este E-mail já está cadastrado no sistema.",
      cnpjJaExiste: "Este CNPJ já está cadastrado no sistema.",
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
      kmInvalido: "O KM informado parece incorreto (diferença muito grande). Verifique o valor.",
      naoEncontrado: "Registro de ponto não encontrado.",
      pausaNaoEncontrada: "Pausa não encontrada.",
      detalhesCalcNecessario: "Aguardando registro para calcular os detalhes.",
    }
  },
  cliente: {
    erro: {
      nomeObrigatorio: "Nome fantasia é obrigatório",
      idObrigatorio: "ID do cliente é obrigatório",
      falhaAtivarDesativar: "Falha ao {acao} o cliente.",
      cnpjJaExiste: "Este CNPJ já está cadastrado para outro cliente.",
    }
  },
  empresa: {
    erro: {
      nomeObrigatorio: "Nome fantasia é obrigatório",
      idObrigatorio: "ID da empresa é obrigatório",
      falhaAtivarDesativar: "Falha ao {acao} a empresa.",
      cnpjJaExiste: "Este CNPJ já está cadastrado para outra empresa.",
    }
  },
  ocorrencia: {
    erro: {
      vinculoObrigatorioImpacto: "Lançamentos com impacto financeiro devem estar vinculados a um turno (vínculo).",
      descricaoJaExiste: "Já existe um tipo de ocorrência com esta descrição."
    }
  }
};
