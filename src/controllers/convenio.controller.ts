import { FastifyRequest, FastifyReply } from "fastify";
import { convenioService } from "../services/convenio.service.js";
import { AppError } from "../errors/AppError.js";
import { z } from "zod";
import {
    createConvenioSchema,
    updateConvenioSchema,
    lancamentoConvenioSchema,
    updateLancamentoConvenioSchema,
    salvarBloqueiosColaboradorSchema
} from "../schemas/convenio.schema.js";

export const convenioController = {
    async list(request: FastifyRequest, reply: FastifyReply) {
        const result = await convenioService.listConvenios();
        return reply.send(result);
    },

    async get(request: FastifyRequest, reply: FastifyReply) {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
        const result = await convenioService.getConvenioById(id);
        return reply.send(result);
    },

    async create(request: FastifyRequest, reply: FastifyReply) {
        const data = createConvenioSchema.parse(request.body);
        const result = await convenioService.createConvenio(data);
        return reply.send(result);
    },

    async update(request: FastifyRequest, reply: FastifyReply) {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
        const data = updateConvenioSchema.parse(request.body);
        const result = await convenioService.updateConvenio(id, data);
        return reply.send(result);
    },

    async delete(request: FastifyRequest, reply: FastifyReply) {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
        await convenioService.deleteConvenio(id);
        return reply.status(204).send();
    },

    async listLancamentos(request: FastifyRequest, reply: FastifyReply) {
        const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
        const { mes, ano } = z.object({
            mes: z.string(),
            ano: z.string()
        }).parse(request.query);
        const result = await convenioService.getLancamentosPorMes(id, parseInt(ano), parseInt(mes));
        return reply.send(result);
    },

    async getPublicInfo(request: FastifyRequest, reply: FastifyReply) {
        try {
            const { token } = z.object({ token: z.string() }).parse(request.params);
            const result = await convenioService.getConvenioByToken(token);
            return reply.send({ id: result.id, nome: result.nome, token: result.token, ativo: result.ativo });
        } catch (error) {
            throw new AppError("Convênio não encontrado", 404);
        }
    },

    async listLancamentosMes(request: FastifyRequest, reply: FastifyReply) {
        const { token } = z.object({ token: z.string() }).parse(request.params);
        const { mes, ano } = z.object({
            mes: z.string(),
            ano: z.string()
        }).parse(request.query);
        const result = await convenioService.getLancamentosPorMesToken(token, parseInt(ano), parseInt(mes));
        return reply.send(result);
    },

    async createLancamento(request: FastifyRequest, reply: FastifyReply) {
        const { token } = z.object({ token: z.string() }).parse(request.params);
        const data = lancamentoConvenioSchema.parse(request.body);
        const result = await convenioService.createLancamentoToken(token, {
            colaborador_id: data.colaborador_id,
            data_lancamento: data.data_lancamento,
            valor: data.valor,
            descricao: data.descricao,
            moto_embu: data.moto_embu,
            is_parcelado: data.is_parcelado,
            quantidade_parcelas: data.quantidade_parcelas,
        });
        return reply.send(result);
    },

    async updateLancamento(request: FastifyRequest, reply: FastifyReply) {
        const { token, id } = z.object({ token: z.string(), id: z.string().uuid() }).parse(request.params);
        const data = updateLancamentoConvenioSchema.parse(request.body);
        const result = await convenioService.updateLancamentoToken(token, id, {
            colaborador_id: data.colaborador_id,
            data_lancamento: data.data_lancamento,
            valor: data.valor,
            descricao: data.descricao,
            moto_embu: data.moto_embu,
            is_parcelado: data.is_parcelado,
            quantidade_parcelas: data.quantidade_parcelas,
        });
        return reply.send(result);
    },

    async deleteLancamento(request: FastifyRequest, reply: FastifyReply) {
        const { token, id } = z.object({ token: z.string(), id: z.string().uuid() }).parse(request.params);
        await convenioService.deleteLancamentoToken(token, id);
        return reply.status(204).send();
    },

    async listColaboradoresPublic(request: FastifyRequest, reply: FastifyReply) {
        const { token } = z.object({ token: z.string() }).parse(request.params);
        const result = await convenioService.getColaboradoresAtivosToken(token);
        return reply.send(result);
    },

    async createLancamentoAdmin(request: FastifyRequest, reply: FastifyReply) {
        const { id: convenioId } = z.object({ id: z.string().uuid() }).parse(request.params);
        const data = lancamentoConvenioSchema.parse(request.body);
        const result = await convenioService.createLancamentoAdmin(convenioId, {
            colaborador_id: data.colaborador_id,
            data_lancamento: data.data_lancamento,
            valor: data.valor,
            descricao: data.descricao,
            moto_embu: data.moto_embu,
            is_parcelado: data.is_parcelado,
            quantidade_parcelas: data.quantidade_parcelas,
        });
        return reply.send(result);
    },

    async updateLancamentoAdmin(request: FastifyRequest, reply: FastifyReply) {
        const { id: convenioId, lancamentoId } = z.object({ id: z.string().uuid(), lancamentoId: z.string().uuid() }).parse(request.params);
        const data = updateLancamentoConvenioSchema.parse(request.body);
        const result = await convenioService.updateLancamentoAdmin(convenioId, lancamentoId, {
            colaborador_id: data.colaborador_id,
            data_lancamento: data.data_lancamento,
            valor: data.valor,
            descricao: data.descricao,
            moto_embu: data.moto_embu,
            is_parcelado: data.is_parcelado,
            quantidade_parcelas: data.quantidade_parcelas,
        });
        return reply.send(result);
    },

    async deleteLancamentoAdmin(request: FastifyRequest, reply: FastifyReply) {
        const { id: convenioId, lancamentoId } = z.object({ id: z.string().uuid(), lancamentoId: z.string().uuid() }).parse(request.params);
        await convenioService.deleteLancamentoAdmin(convenioId, lancamentoId);
        return reply.status(204).send();
    },

    async getBloqueiosColaborador(request: FastifyRequest, reply: FastifyReply) {
        const { colaboradorId } = z.object({ colaboradorId: z.string().uuid() }).parse(request.params);
        const result = await convenioService.getBloqueiosColaborador(colaboradorId);
        return reply.send(result);
    },

    async salvarBloqueiosColaborador(request: FastifyRequest, reply: FastifyReply) {
        const { colaboradorId } = z.object({ colaboradorId: z.string().uuid() }).parse(request.params);
        const data = salvarBloqueiosColaboradorSchema.parse(request.body);
        const usuarioLogado = (request as FastifyRequest & { user?: { id: string } }).user?.id;
        const result = await convenioService.salvarBloqueiosColaborador(colaboradorId, data, usuarioLogado);
        return reply.send(result);
    },

    async listAllBloqueios(request: FastifyRequest, reply: FastifyReply) {
        const result = await convenioService.listarTodosBloqueios();
        return reply.send(result);
    },

    async checkElegibilidade(request: FastifyRequest, reply: FastifyReply) {
        const { colaboradorId, convenioId } = z.object({
            colaboradorId: z.string().uuid(),
            convenioId: z.string().uuid()
        }).parse(request.params);
        const { mes, ano, valor } = z.object({
            mes: z.string().optional(),
            ano: z.string().optional(),
            valor: z.string().optional()
        }).parse(request.query);

        const result = await convenioService.verificarElegibilidadeConvenio(
            colaboradorId,
            convenioId,
            mes ? parseInt(mes, 10) : undefined,
            ano ? parseInt(ano, 10) : undefined,
            valor ? parseFloat(valor) : 0
        );
        return reply.send(result);
    }
};
