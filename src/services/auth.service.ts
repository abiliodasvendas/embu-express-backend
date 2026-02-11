import { PERFIL_ID, STATUS } from "../config/constants.js";
import { supabaseAdmin } from "../config/supabase.js";
import { cleanString, onlyDigits } from "../utils/utils.js";

export interface AuthSession {
    access_token: string;
    refresh_token: string;
    user: any;
}

import { messages } from "../constants/messages.js";

export const authService = {
    async login(cpf: string, password: string): Promise<AuthSession> {
        // 1. Find user by CPF to get email
        const cpfDigits = onlyDigits(cpf);
        if (!cpfDigits) throw new Error(messages.auth.erro.cpfSenhaObrigatorios);
        
        const { data: user, error: userError } = await supabaseAdmin
            .from("usuarios")
            .select("email, status, perfil_id, senha_padrao")
            .eq("cpf", cpfDigits)
            .single();

        if (userError || !user) {
            throw new Error(messages.auth.erro.usuarioNaoEncontrado);
        }

        if (user.status !== STATUS.ATIVO) {
            if (user.status === STATUS.PENDENTE) {
                throw new Error(messages.auth.erro.cadastroPendente);
            }
            throw new Error(messages.auth.erro.acessoNegado);
        }

        // 2. Sign in with Supabase Auth
        const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
            email: user.email,
            password: password
        });

        if (authError || !authData.session) {
            throw new Error(messages.auth.erro.credenciaisInvalidas);
        }

        return {
            access_token: authData.session.access_token,
            refresh_token: authData.session.refresh_token,
            user: {
                ...authData.user,
                perfil_id: user.perfil_id,
                senha_padrao: user.senha_padrao
            }
        };
    },

    async refreshToken(refreshToken: string): Promise<AuthSession> {
        const { data, error } = await supabaseAdmin.auth.refreshSession({ refresh_token: refreshToken });

        if (error || !data.session) {
            throw new Error(messages.auth.erro.sessaoExpirada);
        }

        return {
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
            user: data.user
        };
    },

    async logout(token: string): Promise<void> {
        await supabaseAdmin.auth.admin.signOut(token);
    },

    async updatePassword(token: string, newPassword: string): Promise<void> {
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

        if (userError || !user) {
            throw new Error(messages.auth.erro.tokenInvalido);
        }

        const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
            password: newPassword
        });

        if (error) {
            throw new Error(`${messages.auth.erro.atualizarSenha}: ${error.message}`);
        }

        // 3. Reset first access flag
        await supabaseAdmin
            .from("usuarios")
            .update({ senha_padrao: false })
            .eq("id", user.id);
    },

    async selfRegister(data: any): Promise<any> {
        const emailNormalizado = data.email?.toLowerCase().trim();
        const { password, ...profileData } = data;
        const cpfDigits = onlyDigits(profileData.cpfcnpj || profileData.cpf);
        const isCnpj = cpfDigits.length > 11;
        const nomeLimpo = cleanString(profileData.nome_completo, true);

        // 1. Create Auth User
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: emailNormalizado,
            password: password,
            email_confirm: true,
            user_metadata: {
                nome_completo: nomeLimpo,
                cpf: cpfDigits,
                role: "motoboy"
            }
        });

        if (authError) throw authError;
        if (!authUser?.user) throw new Error(messages.usuario.erro.criarAuth);

        try {
            // 2. Create Profile
            const usuarioData = {
                id: authUser.user.id,
                email: emailNormalizado,
                nome_completo: nomeLimpo,
                cpf: isCnpj ? null : cpfDigits,
                cnpj: isCnpj ? cpfDigits : null,
                telefone: onlyDigits(profileData.telefone),
                telefone_recado: onlyDigits(profileData.telefone_recado),
                data_nascimento: profileData.data_nascimento,
                nome_mae: profileData.nome_mae,
                endereco_completo: profileData.endereco_completo,
                moto_modelo: profileData.moto_modelo,
                moto_cor: profileData.moto_cor,
                moto_ano: profileData.moto_ano,
                moto_placa: profileData.moto_placa ? profileData.moto_placa.toUpperCase() : null,
                cnh_registro: profileData.cnh_registro,
                cnh_vencimento: profileData.cnh_vencimento,
                cnh_categoria: profileData.cnh_categoria?.toUpperCase(),
                chave_pix: profileData.chave_pix,
                status: STATUS.PENDENTE,
                perfil_id: PERFIL_ID.MOTOBOY
            };

            const { data: inserted, error: dbError } = await supabaseAdmin
                .from("usuarios")
                .insert([usuarioData])
                .select()
                .single();

            if (dbError) throw dbError;

            return inserted;
        } catch (error) {
            // Rollback Auth User if DB insert fails
            await supabaseAdmin.auth.admin.deleteUser(authUser.user.id);
            throw error;
        }
    },

    async forgotPassword(email: string): Promise<void> {
        const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
            redirectTo: `${process.env.FRONTEND_URL || 'http://localhost:8080'}/nova-senha`,
        });

        if (error) {
            throw new Error(`${messages.auth.erro.redefinirSenha}: ${error.message}`);
        }
    }
};
