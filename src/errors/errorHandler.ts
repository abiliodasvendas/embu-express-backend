import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { logger } from "../config/logger.js";
import { AppError } from "./AppError.js";

export function globalErrorHandler(error: FastifyError, request: FastifyRequest, reply: FastifyReply) {
    const { method, url } = request;

    // 1. Erro Conhecido (AppError ou validações tratadas)
    if (error instanceof AppError || error.name === 'AppError' || (error as any).isOperational) {
        const statusCode = (error as any).statusCode || 500;
        const message = error.message || "Erro desconhecido";

        logger.warn({
            msg: "Erro Operacional",
            error: message,
            statusCode: statusCode,
            method,
            url
        });
        return reply.status(statusCode).send({
            status: "error",
            message: message,
            error: message
        });
    }

    // 1.5 Erro de Validação Zod
    if (error instanceof ZodError) {
        logger.warn({
            msg: "Erro de Validação (Zod)",
            details: error.issues,
            method,
            url
        });
        return reply.status(400).send({
            status: "error",
            message: "Dados de entrada inválidos.",
            error: "Dados de entrada inválidos.",
            details: error.issues
        });
    }

    // 2. Erros de Validação do Fastify (Schema)
    if (error.validation) {
         logger.warn({
            msg: "Erro de Validação (Schema)",
            error: error.message,
            details: error.validation,
            method,
            url
        });
        return reply.status(400).send({
            status: "error",
            message: "Dados de entrada inválidos.",
            error: "Dados de entrada inválidos.",
            errors: error.validation
        });
    }

    // 2.5 Erro de Banco de Dados (Supabase/Postgres)
    if ((error as any).code === '23503') {
        logger.warn({
            msg: "Violação de Chave Estrangeira (Integridade SQL)",
            error: error.message,
            method,
            url
        });
        
        let customMessage = "Não é possível excluir este registro pois ele já possui histórico (ex: pontos ou ocorrências) associado. Utilize a edição para encerrá-lo/inativá-lo.";
        
        if (error.message?.includes("fk_itens_equipamentos_categoria")) {
            customMessage = "Não é possível excluir esta categoria pois ela possui itens associados no catálogo. Remova ou reassocie os itens antes de tentar excluir.";
        } else if (error.message?.includes("fk_colaborador_itens_item")) {
            customMessage = "Não é possível excluir este item pois ele possui alocações ativas para colaboradores. Desassocie os equipamentos antes de excluir o item.";
        }
        
        return reply.status(400).send({
            status: "error",
            message: customMessage,
            error: customMessage,
            code: '23503'
        });
    }

    if ((error as any).code === '23505') {
        logger.warn({
            msg: "Violação de Registro Único (Integridade SQL)",
            error: error.message,
            method,
            url
        });
        let customMessage = "Este registro já existe.";
        if (error.message?.includes("categoria_itens")) {
            customMessage = "Já existe uma categoria cadastrada com este nome.";
        } else if (error.message?.includes("itens_equipamentos")) {
            customMessage = "Já existe um item cadastrado com este nome.";
        }
        return reply.status(400).send({
            status: "error",
            message: customMessage,
            error: customMessage,
            code: '23505'
        });
    }

    // 2.7 Erro de Autenticação Supabase (AuthApiError)
    if (error.name === 'AuthApiError' || (error as any).status === 422 || (error as any).status === 400) {
        if (error.message?.includes('already been registered')) {
            logger.warn({
                msg: "Erro de Autenticação (Email Duplicado)",
                error: error.message,
                method,
                url
            });
            return reply.status(400).send({
                status: "error",
                message: "Este e-mail já está cadastrado no sistema.",
                error: "Este e-mail já está cadastrado no sistema."
            });
        }
    }

    // 3. Erro Desconhecido (Bug / Infra)
    logger.error({
        msg: "Erro Interno (500)",
        error: error.message,
        stack: error.stack,
        method,
        url,
        // Adicione userId se disponível via request.user
        userId: (request as any).user?.id
    });

    return reply.status(500).send({
        status: "error",
        message: "Ocorreu um erro interno no servidor." 
    });
}
