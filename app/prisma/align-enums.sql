-- Alinha um banco legado criado via init.sql antigo aos enums esperados pelo Prisma.
-- Pode ser executado mais de uma vez com seguranÃ§a.

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

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'usuarios'
      AND column_name = 'perfil'
      AND udt_name <> 'Perfil'
  ) THEN
    ALTER TABLE usuarios ALTER COLUMN perfil DROP DEFAULT;
    ALTER TABLE usuarios
      ALTER COLUMN perfil TYPE "Perfil"
      USING perfil::"Perfil";
    ALTER TABLE usuarios
      ALTER COLUMN perfil SET DEFAULT 'equipe'::"Perfil";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'entregas'
      AND column_name = 'status'
      AND udt_name <> 'StatusEntrega'
  ) THEN
    ALTER TABLE entregas ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE entregas
      ALTER COLUMN status TYPE "StatusEntrega"
      USING status::"StatusEntrega";
    ALTER TABLE entregas
      ALTER COLUMN status SET DEFAULT 'em_producao'::"StatusEntrega";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'aprovacoes'
      AND column_name = 'status'
      AND udt_name <> 'StatusAprovacao'
  ) THEN
    ALTER TABLE aprovacoes ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE aprovacoes
      ALTER COLUMN status TYPE "StatusAprovacao"
      USING status::"StatusAprovacao";
    ALTER TABLE aprovacoes
      ALTER COLUMN status SET DEFAULT 'aguardando'::"StatusAprovacao";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'propostas'
      AND column_name = 'status'
      AND udt_name <> 'StatusProposta'
  ) THEN
    ALTER TABLE propostas ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE propostas
      ALTER COLUMN status TYPE "StatusProposta"
      USING status::"StatusProposta";
    ALTER TABLE propostas
      ALTER COLUMN status SET DEFAULT 'rascunho'::"StatusProposta";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contratos'
      AND column_name = 'status'
      AND udt_name <> 'StatusContrato'
  ) THEN
    ALTER TABLE contratos ALTER COLUMN status DROP DEFAULT;
    ALTER TABLE contratos
      ALTER COLUMN status TYPE "StatusContrato"
      USING status::"StatusContrato";
    ALTER TABLE contratos
      ALTER COLUMN status SET DEFAULT 'pendente'::"StatusContrato";
  END IF;
END $$;
