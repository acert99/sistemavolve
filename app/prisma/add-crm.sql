-- Base incremental do CRM comercial / pipeline de leads.
-- Pode ser executado com seguranca em bancos legados.

DO $$ BEGIN
  CREATE TYPE "LeadSource" AS ENUM ('indicacao', 'instagram', 'site', 'outro');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeadStage" AS ENUM ('new', 'contacted', 'meeting', 'proposal', 'negotiation', 'won', 'lost');
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
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  company           TEXT,
  phone             TEXT NOT NULL,
  email             TEXT,
  instagram         TEXT,
  source            "LeadSource" NOT NULL DEFAULT 'outro',
  referred_by       TEXT,
  stage             "LeadStage" NOT NULL DEFAULT 'new',
  assigned_to       UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  services_interest TEXT[] NOT NULL DEFAULT '{}',
  estimated_value   NUMERIC(10,2),
  notes             TEXT,
  next_action       TEXT,
  next_action_date  TIMESTAMPTZ,
  lost_reason       TEXT,
  converted_at      TIMESTAMPTZ,
  client_id         UUID UNIQUE REFERENCES clientes(id) ON DELETE SET NULL,
  stage_changed_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lead_timeline (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type       "LeadTimelineType" NOT NULL,
  content    TEXT,
  metadata   JSONB,
  created_by UUID REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS follow_up_jobs (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id      UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type         TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at      TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  message      TEXT NOT NULL,
  metadata     JSONB,
  status       "FollowUpJobStatus" NOT NULL DEFAULT 'pending',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_stage
  ON leads(stage);

CREATE INDEX IF NOT EXISTS idx_leads_assigned_to
  ON leads(assigned_to);

CREATE INDEX IF NOT EXISTS idx_leads_phone
  ON leads(phone);

CREATE INDEX IF NOT EXISTS idx_leads_created_at
  ON leads(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lead_timeline_lead
  ON lead_timeline(lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_followup_lead
  ON follow_up_jobs(lead_id);

CREATE INDEX IF NOT EXISTS idx_followup_pending
  ON follow_up_jobs(scheduled_at)
  WHERE status = 'pending';

ALTER TABLE propostas
  ALTER COLUMN cliente_id DROP NOT NULL;

ALTER TABLE propostas
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;

ALTER TABLE templates_mensagem
  ADD COLUMN IF NOT EXISTS stage TEXT;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'trigger_set_updated_at'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_updated_at_leads'
  ) THEN
    CREATE TRIGGER set_updated_at_leads
    BEFORE UPDATE ON leads
    FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
  END IF;
END $$;

INSERT INTO templates_mensagem (name, categoria, stage, content)
SELECT *
FROM (
  VALUES
    (
      'Primeiro contato - indicacao',
      'crm',
      'contacted',
      'Ola {{nome}}! {{quem_indicou}} me passou seu contato. Tenho algumas ideias que podem fazer sentido para o seu negocio. Podemos conversar 10 minutinhos essa semana?'
    ),
    (
      'Primeiro contato - Instagram',
      'crm',
      'contacted',
      'Ola {{nome}}! Vi que voce entrou em contato com a gente. Fico feliz! Me conta um pouco mais sobre o que voce esta buscando?'
    ),
    (
      'Lembrete reuniao',
      'crm',
      'meeting',
      'Oi {{nome}}! So passando para lembrar que nossa conversa e {{dia_hora}}. Nos vemos la!'
    ),
    (
      'Follow-up proposta D+3',
      'crm',
      'proposal',
      'Oi {{nome}}, tudo bem? Queria saber se teve a chance de ver a proposta. Posso esclarecer alguma duvida ou ajustar algo?'
    ),
    (
      'Follow-up proposta D+7',
      'crm',
      'proposal',
      'Ola {{nome}}! Sei que a semana e corrida. A proposta fica disponivel quando voce quiser revisitar: {{link_proposta}}. Ha algo que posso ajustar?'
    ),
    (
      'Follow-up proposta D+14',
      'crm',
      'proposal',
      'Oi {{nome}}, faco esse ultimo contato para nao ser invasivo. Se o momento nao e agora, tudo bem — estaremos aqui quando fizer sentido.'
    ),
    (
      'Boas-vindas cliente',
      'crm',
      'won',
      'Seja bem-vindo a Volve, {{nome}}! Estamos muito animados em comecar esse trabalho juntos. Em breve entraremos em contato para alinhar os proximos passos.'
    )
) AS seed(name, categoria, stage, content)
WHERE NOT EXISTS (
  SELECT 1
  FROM templates_mensagem tm
  WHERE tm.name = seed.name
);
