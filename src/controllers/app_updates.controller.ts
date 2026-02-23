import { FastifyReply, FastifyRequest } from "fastify";
import { supabaseAdmin } from "../config/supabase.js";

// Ensure table name matches the one created in the SQL schema
const TABLE_NAME = "app_updates";

export const getLatestUpdate = async (
    request: FastifyRequest<{ Querystring: { platform: string } }>,
    reply: FastifyReply
) => {
    try {
        const { platform } = request.query;

        if (!platform) {
            return reply.status(400).send({
                error: "Missing platform query parameter",
                message: "O parâmetro 'platform' (ex: 'android', 'ios') é obrigatório.",
            });
        }

        const { data, error } = await supabaseAdmin
            .from(TABLE_NAME)
            .select("latest_version, url_zip, force_update")
            .eq("platform", platform)
            .order("created_at", { ascending: false })
            .limit(1)
            .single();

        if (error) {
            // PGRST116 is the error code for "no rows returned" in Supabase
            if (error.code === "PGRST116") {
                return reply.status(404).send({
                    error: "Not Found",
                    message: "Nenhuma atualização encontrada para a plataforma informada.",
                });
            }
            throw error;
        }

        return reply.status(200).send(data);
    } catch (error: any) {
        console.error("[AppUpdatesController] Error:", error);
        return reply.status(500).send({
            error: "Internal Server Error",
            message: error.message || "Erro interno do servidor.",
        });
    }
};
