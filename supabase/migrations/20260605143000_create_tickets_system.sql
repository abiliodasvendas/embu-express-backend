-- TABLE: tickets (chamados)
CREATE TABLE IF NOT EXISTS "public"."tickets" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "title" character varying(255) NOT NULL,
    "description" text NOT NULL,
    "type" character varying(50) NOT NULL CONSTRAINT check_ticket_type CHECK (type IN ('BUG', 'FEATURE', 'IMPROVEMENT')),
    "status" character varying(50) DEFAULT 'OPEN' NOT NULL CONSTRAINT check_ticket_status CHECK (status IN ('OPEN', 'IN_PROGRESS', 'DONE', 'CANCELED')),
    "priority" character varying(50) DEFAULT 'MEDIUM' NOT NULL CONSTRAINT check_ticket_priority CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH')),
    "author_id" uuid NOT NULL,
    "attachments" text[] DEFAULT '{}'::text[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."tickets" OWNER TO "postgres";

-- TABLE: ticket_comments (comentarios)
CREATE TABLE IF NOT EXISTS "public"."ticket_comments" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "ticket_id" uuid NOT NULL,
    "author_id" uuid NOT NULL,
    "content" text NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);
ALTER TABLE "public"."ticket_comments" OWNER TO "postgres";

-- CONSTRAINTS
ALTER TABLE ONLY "public"."tickets" ADD CONSTRAINT "fk_tickets_author" FOREIGN KEY ("author_id") REFERENCES "public"."usuarios"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."ticket_comments" ADD CONSTRAINT "fk_comments_ticket" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE CASCADE;
ALTER TABLE ONLY "public"."ticket_comments" ADD CONSTRAINT "fk_comments_author" FOREIGN KEY ("author_id") REFERENCES "public"."usuarios"("id") ON DELETE CASCADE;

-- DISABLE RLS
ALTER TABLE "public"."tickets" DISABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ticket_comments" DISABLE ROW LEVEL SECURITY;

-- INDEXES
CREATE INDEX IF NOT EXISTS "idx_tickets_author" ON "public"."tickets" USING "btree" ("author_id");
CREATE INDEX IF NOT EXISTS "idx_tickets_status" ON "public"."tickets" USING "btree" ("status");
CREATE INDEX IF NOT EXISTS "idx_comments_ticket" ON "public"."ticket_comments" USING "btree" ("ticket_id");

-- GRANTS
GRANT ALL ON TABLE "public"."tickets" TO "anon", "authenticated", "service_role";
GRANT ALL ON TABLE "public"."ticket_comments" TO "anon", "authenticated", "service_role";

-- INITIAL SYSTEM PERMISSIONS FOR CHAMADOS
INSERT INTO "public"."permissoes" ("nome_interno", "modulo", "descricao") VALUES
('chamados:ver', 'Chamados', 'Visualizar o quadro de chamados e detalhes'),
('chamados:criar', 'Chamados', 'Abrir novos chamados, editar prioridade e comentar'),
('chamados:status', 'Chamados', 'Alterar o status de chamados (Admin)'),
('chamados:deletar', 'Chamados', 'Excluir chamados do sistema')
ON CONFLICT (nome_interno) DO UPDATE SET 
    modulo = EXCLUDED.modulo,
    descricao = EXCLUDED.descricao;

-- ASSOCIATE TO ALL PROFILES SINCE ALL INTERNAL USERS CAN VIEW AND CREATE
INSERT INTO "public"."perfil_permissoes" ("perfil_id", "permissao_id")
SELECT p.id as perfil_id, perm.id as permissao_id
FROM "public"."perfis" p
CROSS JOIN "public"."permissoes" perm
WHERE p.nome IN ('super_admin', 'admin', 'motoboy')
  AND perm.nome_interno IN ('chamados:ver', 'chamados:criar')
ON CONFLICT DO NOTHING;

-- ASSOCIATE ADMIN ONLY PERMISSIONS
INSERT INTO "public"."perfil_permissoes" ("perfil_id", "permissao_id")
SELECT p.id as perfil_id, perm.id as permissao_id
FROM "public"."perfis" p
CROSS JOIN "public"."permissoes" perm
WHERE p.nome IN ('super_admin', 'admin')
  AND perm.nome_interno IN ('chamados:status', 'chamados:deletar')
ON CONFLICT DO NOTHING;

-- SYNC SEQUENCES AVOID CONFLICTS
SELECT setval('public.permissoes_id_seq', (SELECT MAX(id) FROM public.permissoes));

-- STORAGE BUCKET E POLÍTICAS DE RLS DO STORAGE
INSERT INTO storage.buckets (id, name, public) 
VALUES ('ticket-attachments', 'ticket-attachments', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Permitir leitura pública de anexos de chamados" ON storage.objects;
CREATE POLICY "Permitir leitura pública de anexos de chamados" ON storage.objects
    FOR SELECT USING (bucket_id = 'ticket-attachments');

DROP POLICY IF EXISTS "Permitir upload de anexos por usuários autenticados" ON storage.objects;
CREATE POLICY "Permitir upload de anexos por usuários autenticados" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ticket-attachments');
