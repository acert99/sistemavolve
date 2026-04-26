-- =============================================================================
-- Plataforma Volve â€” InicializaÃ§Ã£o do Banco de Dados
-- PostgreSQL 16
-- Execute automaticamente via Docker volume mount em /docker-entrypoint-initdb.d/
-- =============================================================================

-- ExtensÃµes necessÃ¡rias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- busca fuzzy em textos

-- Tipos alinhados ao Prisma
DO $$ BEGIN
  CREATE TYPE "Perfil" AS ENUM ('equipe', 'cliente');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StatusEntrega" AS ENUM (
    'em_producao',
    'aguardando_aprovacao',
    'aprovado',
    'reprovado',
    'entregue'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StatusAprovacao" AS ENUM ('aguardando', 'aprovado', 'reprovado');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StatusProposta" AS ENUM (
    'rascunho',
    'enviada',
    'visualizada',
    'aceita',
    'recusada',
    'expirada'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "StatusContrato" AS ENUM ('pendente', 'enviado', 'assinado', 'cancelado');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- 1. USUÃRIOS (autenticaÃ§Ã£o e perfis de acesso)
-- =============================================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  senha_hash    VARCHAR(255),                        -- bcrypt
  perfil        "Perfil"     NOT NULL DEFAULT 'equipe', -- 'equipe' | 'cliente'
  cliente_id    UUID,                                -- preenchido quando perfil = 'cliente'
  ativo         BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_usuarios_email  ON usuarios(email);
CREATE INDEX idx_usuarios_perfil ON usuarios(perfil);

-- =============================================================================
-- 2. CLIENTES
-- =============================================================================
CREATE TABLE IF NOT EXISTS clientes (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  whatsapp      VARCHAR(20),                        -- formato: 5511999999999
  cpf_cnpj      VARCHAR(18)  UNIQUE,
  asaas_id      VARCHAR(255),                       -- ID do cliente no Asaas
  ativo         BOOLEAN      NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clientes_email      ON clientes(email);
CREATE INDEX idx_clientes_cpf_cnpj   ON clientes(cpf_cnpj);
CREATE INDEX idx_clientes_asaas_id   ON clientes(asaas_id);
-- Busca por nome (pg_trgm)
CREATE INDEX idx_clientes_nome_trgm ON clientes USING gin(nome gin_trgm_ops);

-- FK de usuarios â†’ clientes (adicionada apÃ³s criaÃ§Ã£o das duas tabelas)
ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_cliente
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;

-- =============================================================================
-- 3. SERVIÃ‡OS (catÃ¡logo)
-- =============================================================================
CREATE TABLE IF NOT EXISTS servicos (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          VARCHAR(255)  NOT NULL,
  descricao     TEXT,
  preco         NUMERIC(12,2) NOT NULL DEFAULT 0,
  categoria     VARCHAR(100),
  ativo         BOOLEAN       NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_servicos_categoria ON servicos(categoria);
CREATE INDEX idx_servicos_ativo     ON servicos(ativo);

-- =============================================================================
-- 4. ENTREGAS (tarefas/entregÃ¡veis vinculados ao ClickUp)
-- =============================================================================
CREATE TABLE IF NOT EXISTS entregas (
  id               UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       UUID            NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  servico_id       UUID            REFERENCES servicos(id) ON DELETE SET NULL,
  clickup_task_id  VARCHAR(255),                   -- ID da task no ClickUp
  titulo           VARCHAR(255)    NOT NULL,
  descricao        TEXT,
  status           "StatusEntrega" NOT NULL DEFAULT 'em_producao',
  -- Status possÃ­veis: em_producao | aguardando_aprovacao | aprovado | reprovado | entregue
  arquivo_url      VARCHAR(500),                   -- URL do arquivo entregÃ¡vel
  created_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entregas_cliente_id      ON entregas(cliente_id);
CREATE INDEX idx_entregas_clickup_task_id ON entregas(clickup_task_id);
CREATE INDEX idx_entregas_status          ON entregas(status);

-- =============================================================================
-- 5. APROVAÃ‡Ã•ES (ciclo de aprovaÃ§Ã£o de entregas)
-- =============================================================================
CREATE TABLE IF NOT EXISTS aprovacoes (
  id            UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id    UUID               NOT NULL REFERENCES entregas(id) ON DELETE CASCADE,
  cliente_id    UUID               NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  status        "StatusAprovacao"  NOT NULL DEFAULT 'aguardando',
  -- Status: aguardando | aprovado | reprovado
  comentario    TEXT,                              -- feedback do cliente
  aprovado_em   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_aprovacoes_entrega_id  ON aprovacoes(entrega_id);
CREATE INDEX idx_aprovacoes_cliente_id  ON aprovacoes(cliente_id);
CREATE INDEX idx_aprovacoes_status      ON aprovacoes(status);

-- =============================================================================
-- 6. PROPOSTAS (geraÃ§Ã£o de PDF + link Ãºnico)
-- =============================================================================
CREATE TABLE IF NOT EXISTS propostas (
  id              UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      UUID               NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  titulo          VARCHAR(255)       NOT NULL,
  descricao       TEXT,
  itens           JSONB              NOT NULL DEFAULT '[]',
  -- [{servico_id, nome, descricao, quantidade, valor_unitario}]
  valor_total     NUMERIC(12,2)      NOT NULL DEFAULT 0,
  token           VARCHAR(255)       UNIQUE NOT NULL,   -- slug Ãºnico para link pÃºblico
  status          "StatusProposta"   NOT NULL DEFAULT 'rascunho',
  -- Status: rascunho | enviada | visualizada | aceita | recusada | expirada
  validade        DATE,
  pdf_url         VARCHAR(500),
  visualizado_em  TIMESTAMPTZ,
  aceito_em       TIMESTAMPTZ,
  recusado_em     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_propostas_cliente_id ON propostas(cliente_id);
CREATE INDEX idx_propostas_token      ON propostas(token);
CREATE INDEX idx_propostas_status     ON propostas(status);

-- =============================================================================
-- 7. CONTRATOS (Autentique â€” assinatura eletrÃ´nica)
-- =============================================================================
CREATE TABLE IF NOT EXISTS contratos (
  id               UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       UUID               NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  proposta_id      UUID               REFERENCES propostas(id) ON DELETE SET NULL,
  autentique_id    VARCHAR(255),                   -- ID do documento no Autentique
  titulo           VARCHAR(255)       NOT NULL,
  conteudo         TEXT,                           -- HTML do contrato
  status           "StatusContrato"   NOT NULL DEFAULT 'pendente',
  -- Status: pendente | enviado | assinado | cancelado
  documento_url    VARCHAR(500),                   -- URL do PDF assinado
  link_assinatura  VARCHAR(500),                   -- Link para o signatÃ¡rio assinar
  assinado_em      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contratos_cliente_id    ON contratos(cliente_id);
CREATE INDEX idx_contratos_proposta_id   ON contratos(proposta_id);
CREATE INDEX idx_contratos_autentique_id ON contratos(autentique_id);
CREATE INDEX idx_contratos_status        ON contratos(status);

-- =============================================================================
-- 8. COBRANÃ‡AS (Asaas â€” boleto/PIX/cartÃ£o)
-- =============================================================================
CREATE TABLE IF NOT EXISTS cobrancas (
  id               UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       UUID          NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  contrato_id      UUID          REFERENCES contratos(id) ON DELETE SET NULL,
  asaas_id         VARCHAR(255),                   -- ID do charge no Asaas
  descricao        VARCHAR(255)  NOT NULL,
  valor            NUMERIC(12,2) NOT NULL,
  vencimento       DATE          NOT NULL,
  tipo             VARCHAR(50)   NOT NULL DEFAULT 'BOLETO',
  -- Tipos: BOLETO | PIX | CREDIT_CARD | DEBIT_CARD | UNDEFINED
  status           VARCHAR(50)   NOT NULL DEFAULT 'PENDING',
  -- Status Asaas: PENDING | RECEIVED | CONFIRMED | OVERDUE | REFUNDED | RECEIVED_IN_CASH | REFUND_REQUESTED | CHARGEBACK_REQUESTED | CHARGEBACK_DISPUTE | AWAITING_CHARGEBACK_REVERSAL | DUNNING_REQUESTED | DUNNING_RECEIVED | AWAITING_RISK_ANALYSIS
  link_pagamento   VARCHAR(500),                   -- URL para pagamento
  invoice_url      VARCHAR(500),                   -- URL da fatura/boleto
  pix_copia_cola   TEXT,                           -- cÃ³digo PIX copia e cola
  pago_em          TIMESTAMPTZ,
  notificado_em    TIMESTAMPTZ,                    -- Ãºltima notificaÃ§Ã£o WhatsApp
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cobrancas_cliente_id  ON cobrancas(cliente_id);
CREATE INDEX idx_cobrancas_contrato_id ON cobrancas(contrato_id);
CREATE INDEX idx_cobrancas_asaas_id    ON cobrancas(asaas_id);
CREATE INDEX idx_cobrancas_status      ON cobrancas(status);
CREATE INDEX idx_cobrancas_vencimento  ON cobrancas(vencimento);

-- =============================================================================
-- 9. COMUNICACAO (WhatsApp, templates e mensagens agendadas)
-- =============================================================================
CREATE TABLE IF NOT EXISTS canais_whatsapp (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  provider            VARCHAR(50)  NOT NULL DEFAULT 'evolution',
  instance_name       VARCHAR(255) NOT NULL,
  status              VARCHAR(50)  NOT NULL DEFAULT 'disconnected',
  phone_number        VARCHAR(32),
  last_connection_at  TIMESTAMPTZ,
  last_error          TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_canais_whatsapp_provider_instance UNIQUE (provider, instance_name)
);

CREATE TABLE IF NOT EXISTS templates_mensagem (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  categoria   VARCHAR(100),
  content     TEXT         NOT NULL,
  is_active   BOOLEAN      NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mensagens_agendadas (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id           UUID         NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  channel              VARCHAR(50)  NOT NULL DEFAULT 'whatsapp',
  template_id          UUID         REFERENCES templates_mensagem(id) ON DELETE SET NULL,
  message_content      TEXT         NOT NULL,
  scheduled_for        TIMESTAMPTZ  NOT NULL,
  status               VARCHAR(50)  NOT NULL DEFAULT 'scheduled',
  external_message_id  VARCHAR(255),
  sent_at              TIMESTAMPTZ,
  error_message        TEXT,
  created_by           UUID         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_canais_whatsapp_status                 ON canais_whatsapp(status);
CREATE INDEX idx_templates_mensagem_active              ON templates_mensagem(is_active);
CREATE INDEX idx_mensagens_agendadas_cliente_id         ON mensagens_agendadas(cliente_id);
CREATE INDEX idx_mensagens_agendadas_template_id        ON mensagens_agendadas(template_id);
CREATE INDEX idx_mensagens_agendadas_status_scheduled   ON mensagens_agendadas(status, scheduled_for);

-- =============================================================================
-- 10. CRM COMERCIAL (pipeline, timeline e jobs de follow-up)
-- =============================================================================
DO $$ BEGIN
  CREATE TYPE "LeadSource" AS ENUM ('indicacao', 'instagram', 'site', 'outro');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeadStage" AS ENUM (
    'new',
    'contacted',
    'meeting',
    'proposal',
    'negotiation',
    'won',
    'lost'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeadTimelineType" AS ENUM (
    'stage_change',
    'wa_sent',
    'wa_received',
    'note',
    'proposal_sent',
    'meeting_scheduled',
    'converted'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "FollowUpJobStatus" AS ENUM ('pending', 'sent', 'cancelled', 'failed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS leads (
  id                 UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  name               VARCHAR(255)        NOT NULL,
  company            VARCHAR(255),
  phone              VARCHAR(20)         NOT NULL,
  email              VARCHAR(255),
  instagram          VARCHAR(255),
  source             "LeadSource"        NOT NULL DEFAULT 'outro',
  referred_by        VARCHAR(255),
  stage              "LeadStage"         NOT NULL DEFAULT 'new',
  assigned_to        UUID                REFERENCES usuarios(id) ON DELETE SET NULL,
  services_interest  TEXT[]              NOT NULL DEFAULT '{}',
  estimated_value    NUMERIC(10,2),
  notes              TEXT,
  next_action        TEXT,
  next_action_date   TIMESTAMPTZ,
  lost_reason        TEXT,
  converted_at       TIMESTAMPTZ,
  client_id          UUID                UNIQUE REFERENCES clientes(id) ON DELETE SET NULL,
  stage_changed_at   TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  created_at         TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_timeline (
  id          UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID                NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type        "LeadTimelineType"  NOT NULL,
  content     TEXT,
  metadata    JSONB,
  created_by  UUID                REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ         NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS follow_up_jobs (
  id            UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID                  NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type          VARCHAR(100)          NOT NULL,
  scheduled_at  TIMESTAMPTZ           NOT NULL,
  sent_at       TIMESTAMPTZ,
  cancelled_at  TIMESTAMPTZ,
  message       TEXT                  NOT NULL,
  metadata      JSONB,
  status        "FollowUpJobStatus"   NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

ALTER TABLE propostas
  ALTER COLUMN cliente_id DROP NOT NULL;

ALTER TABLE propostas
  DROP CONSTRAINT IF EXISTS propostas_cliente_id_fkey;

ALTER TABLE propostas
  ADD CONSTRAINT propostas_cliente_id_fkey
    FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;

ALTER TABLE propostas
  ADD COLUMN IF NOT EXISTS lead_id UUID;

ALTER TABLE propostas
  DROP CONSTRAINT IF EXISTS propostas_lead_id_fkey;

ALTER TABLE propostas
  ADD CONSTRAINT propostas_lead_id_fkey
    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE SET NULL;

ALTER TABLE templates_mensagem
  ADD COLUMN IF NOT EXISTS stage VARCHAR(100);

CREATE INDEX idx_leads_stage                ON leads(stage);
CREATE INDEX idx_leads_assigned_to          ON leads(assigned_to);
CREATE INDEX idx_leads_phone                ON leads(phone);
CREATE INDEX idx_leads_created_at           ON leads(created_at DESC);
CREATE INDEX idx_lead_timeline_lead         ON lead_timeline(lead_id, created_at DESC);
CREATE INDEX idx_follow_up_jobs_lead        ON follow_up_jobs(lead_id);
CREATE INDEX idx_follow_up_jobs_pending     ON follow_up_jobs(scheduled_at)
  WHERE status = 'pending';
CREATE INDEX idx_propostas_lead_id          ON propostas(lead_id);
CREATE INDEX idx_templates_mensagem_stage   ON templates_mensagem(stage);

-- =============================================================================
-- Triggers para updated_at automÃ¡tico
-- =============================================================================
CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_usuarios   BEFORE UPDATE ON usuarios   FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_clientes   BEFORE UPDATE ON clientes   FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_servicos   BEFORE UPDATE ON servicos   FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_entregas   BEFORE UPDATE ON entregas   FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_aprovacoes BEFORE UPDATE ON aprovacoes FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_propostas  BEFORE UPDATE ON propostas  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_contratos  BEFORE UPDATE ON contratos  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_cobrancas  BEFORE UPDATE ON cobrancas  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_leads       BEFORE UPDATE ON leads       FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_canais_whatsapp      BEFORE UPDATE ON canais_whatsapp      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_templates_mensagem   BEFORE UPDATE ON templates_mensagem   FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
CREATE TRIGGER set_updated_at_mensagens_agendadas  BEFORE UPDATE ON mensagens_agendadas  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =============================================================================
-- Seed inicial
-- O usuario admin agora deve ser criado manualmente via scripts/seed-admin.ts
-- usando ADMIN_INITIAL_PASSWORD no ambiente de setup.
-- =============================================================================

INSERT INTO templates_mensagem (name, categoria, stage, content, is_active)
SELECT *
FROM (
  VALUES
    ('Primeiro contato - indicacao', 'crm', 'contacted',
      'Ola {{nome}}! {{quem_indicou}} me passou seu contato. Tenho algumas ideias que podem fazer sentido para o seu negocio. Podemos conversar 10 minutinhos essa semana?',
      true),
    ('Primeiro contato - Instagram', 'crm', 'contacted',
      'Ola {{nome}}! Vi que voce entrou em contato com a gente. Fico feliz! Me conta um pouco mais sobre o que voce esta buscando?',
      true),
    ('Lembrete reuniao', 'crm', 'meeting',
      'Oi {{nome}}! So passando para lembrar que nossa conversa e {{dia_hora}}. Nos vemos la!',
      true),
    ('Follow-up proposta D+3', 'crm', 'proposal',
      'Oi {{nome}}, tudo bem? Queria saber se teve a chance de ver a proposta. Posso esclarecer alguma duvida ou ajustar algo?',
      true),
    ('Follow-up proposta D+7', 'crm', 'proposal',
      'Ola {{nome}}! Sei que a semana e corrida. A proposta fica disponivel quando voce quiser revisitar: {{link_proposta}}. Ha algo que posso ajustar?',
      true),
    ('Follow-up proposta D+14', 'crm', 'proposal',
      'Oi {{nome}}, faco esse ultimo contato para nao ser invasivo. Se o momento nao e agora, tudo bem — estaremos aqui quando fizer sentido.',
      true),
    ('Boas-vindas cliente', 'crm', 'won',
      'Seja bem-vindo a Volve, {{nome}}! Estamos muito animados em comecar esse trabalho juntos. Em breve entraremos em contato para alinhar os proximos passos.',
      true)
) AS seed(name, categoria, stage, content, is_active)
WHERE NOT EXISTS (
  SELECT 1
  FROM templates_mensagem template
  WHERE template.name = seed.name
);
