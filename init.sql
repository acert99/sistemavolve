-- =============================================================================
-- Plataforma Volve — Inicialização do Banco de Dados
-- PostgreSQL 16
-- Execute automaticamente via Docker volume mount em /docker-entrypoint-initdb.d/
-- =============================================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- busca fuzzy em textos

-- =============================================================================
-- 1. USUÁRIOS (autenticação e perfis de acesso)
-- =============================================================================
CREATE TABLE IF NOT EXISTS usuarios (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          VARCHAR(255) NOT NULL,
  email         VARCHAR(255) UNIQUE NOT NULL,
  senha_hash    VARCHAR(255),                       -- bcrypt
  perfil        VARCHAR(50)  NOT NULL DEFAULT 'equipe', -- 'equipe' | 'cliente'
  cliente_id    UUID,                               -- preenchido quando perfil = 'cliente'
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
CREATE INDEX idx_clientes_cpf_cnpj  ON clientes(cpf_cnpj);
CREATE INDEX idx_clientes_asaas_id  ON clientes(asaas_id);
-- Busca por nome (pg_trgm)
CREATE INDEX idx_clientes_nome_trgm ON clientes USING gin(nome gin_trgm_ops);

-- FK de usuarios → clientes (adicionada após criação das duas tabelas)
ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_cliente
  FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL;

-- =============================================================================
-- 3. SERVIÇOS (catálogo)
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
-- 4. ENTREGAS (tarefas/entregáveis vinculados ao ClickUp)
-- =============================================================================
CREATE TABLE IF NOT EXISTS entregas (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       UUID         NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  servico_id       UUID         REFERENCES servicos(id) ON DELETE SET NULL,
  clickup_task_id  VARCHAR(255),                   -- ID da task no ClickUp
  titulo           VARCHAR(255) NOT NULL,
  descricao        TEXT,
  status           VARCHAR(50)  NOT NULL DEFAULT 'em_producao',
  -- Status possíveis: em_producao | aguardando_aprovacao | aprovado | reprovado | entregue
  arquivo_url      VARCHAR(500),                   -- URL do arquivo entregável
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_entregas_cliente_id      ON entregas(cliente_id);
CREATE INDEX idx_entregas_clickup_task_id ON entregas(clickup_task_id);
CREATE INDEX idx_entregas_status          ON entregas(status);

-- =============================================================================
-- 5. APROVAÇÕES (ciclo de aprovação de entregas)
-- =============================================================================
CREATE TABLE IF NOT EXISTS aprovacoes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  entrega_id    UUID        NOT NULL REFERENCES entregas(id) ON DELETE CASCADE,
  cliente_id    UUID        NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  status        VARCHAR(50) NOT NULL DEFAULT 'aguardando',
  -- Status: aguardando | aprovado | reprovado
  comentario    TEXT,                              -- feedback do cliente
  aprovado_em   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_aprovacoes_entrega_id  ON aprovacoes(entrega_id);
CREATE INDEX idx_aprovacoes_cliente_id  ON aprovacoes(cliente_id);
CREATE INDEX idx_aprovacoes_status      ON aprovacoes(status);

-- =============================================================================
-- 6. PROPOSTAS (geração de PDF + link único)
-- =============================================================================
CREATE TABLE IF NOT EXISTS propostas (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id      UUID          NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  titulo          VARCHAR(255)  NOT NULL,
  descricao       TEXT,
  itens           JSONB         NOT NULL DEFAULT '[]',
  -- [{servico_id, nome, descricao, quantidade, valor_unitario}]
  valor_total     NUMERIC(12,2) NOT NULL DEFAULT 0,
  token           VARCHAR(255)  UNIQUE NOT NULL,   -- slug único para link público
  status          VARCHAR(50)   NOT NULL DEFAULT 'rascunho',
  -- Status: rascunho | enviada | visualizada | aceita | recusada | expirada
  validade        DATE,
  pdf_url         VARCHAR(500),
  visualizado_em  TIMESTAMPTZ,
  aceito_em       TIMESTAMPTZ,
  recusado_em     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_propostas_cliente_id ON propostas(cliente_id);
CREATE INDEX idx_propostas_token      ON propostas(token);
CREATE INDEX idx_propostas_status     ON propostas(status);

-- =============================================================================
-- 7. CONTRATOS (Autentique — assinatura eletrônica)
-- =============================================================================
CREATE TABLE IF NOT EXISTS contratos (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       UUID         NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  proposta_id      UUID         REFERENCES propostas(id) ON DELETE SET NULL,
  autentique_id    VARCHAR(255),                   -- ID do documento no Autentique
  titulo           VARCHAR(255) NOT NULL,
  conteudo         TEXT,                           -- HTML do contrato
  status           VARCHAR(50)  NOT NULL DEFAULT 'pendente',
  -- Status: pendente | enviado | assinado | cancelado
  documento_url    VARCHAR(500),                   -- URL do PDF assinado
  link_assinatura  VARCHAR(500),                   -- Link para o signatário assinar
  assinado_em      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contratos_cliente_id    ON contratos(cliente_id);
CREATE INDEX idx_contratos_proposta_id   ON contratos(proposta_id);
CREATE INDEX idx_contratos_autentique_id ON contratos(autentique_id);
CREATE INDEX idx_contratos_status        ON contratos(status);

-- =============================================================================
-- 8. COBRANÇAS (Asaas — boleto/PIX/cartão)
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
  pix_copia_cola   TEXT,                           -- código PIX copia e cola
  pago_em          TIMESTAMPTZ,
  notificado_em    TIMESTAMPTZ,                    -- última notificação WhatsApp
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cobrancas_cliente_id  ON cobrancas(cliente_id);
CREATE INDEX idx_cobrancas_contrato_id ON cobrancas(contrato_id);
CREATE INDEX idx_cobrancas_asaas_id    ON cobrancas(asaas_id);
CREATE INDEX idx_cobrancas_status      ON cobrancas(status);
CREATE INDEX idx_cobrancas_vencimento  ON cobrancas(vencimento);

-- =============================================================================
-- Triggers para updated_at automático
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

-- =============================================================================
-- Seed inicial — usuário admin da equipe
-- Senha padrão: Volve@2025 (bcrypt hash — TROQUE em produção!)
-- =============================================================================
INSERT INTO usuarios (nome, email, senha_hash, perfil) VALUES
  (
    'Admin Volve',
    'admin@volve.com.br',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiNJsLtScIflsxExFQfFIU3P38Jm',
    'equipe'
  )
ON CONFLICT (email) DO NOTHING;
