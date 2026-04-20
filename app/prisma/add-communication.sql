-- Adiciona a base minima do modulo de comunicacao em bancos legados.
-- Pode ser executado mais de uma vez com seguranca.

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

CREATE INDEX IF NOT EXISTS idx_canais_whatsapp_status
  ON canais_whatsapp(status);

CREATE INDEX IF NOT EXISTS idx_templates_mensagem_active
  ON templates_mensagem(is_active);

CREATE INDEX IF NOT EXISTS idx_mensagens_agendadas_cliente_id
  ON mensagens_agendadas(cliente_id);

CREATE INDEX IF NOT EXISTS idx_mensagens_agendadas_template_id
  ON mensagens_agendadas(template_id);

CREATE INDEX IF NOT EXISTS idx_mensagens_agendadas_status_scheduled
  ON mensagens_agendadas(status, scheduled_for);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc
    WHERE proname = 'trigger_set_updated_at'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'set_updated_at_canais_whatsapp'
    ) THEN
      CREATE TRIGGER set_updated_at_canais_whatsapp
      BEFORE UPDATE ON canais_whatsapp
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'set_updated_at_templates_mensagem'
    ) THEN
      CREATE TRIGGER set_updated_at_templates_mensagem
      BEFORE UPDATE ON templates_mensagem
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM pg_trigger
      WHERE tgname = 'set_updated_at_mensagens_agendadas'
    ) THEN
      CREATE TRIGGER set_updated_at_mensagens_agendadas
      BEFORE UPDATE ON mensagens_agendadas
      FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();
    END IF;
  END IF;
END $$;
