-- Calendario de Conteudo (MVP) — Ideias

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "CalendarioIdeiaStatus" AS ENUM ('draft', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "calendario_ideias" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "cliente_id" UUID NOT NULL,
  "month_key" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "scheduled_date" DATE,
  "status" "CalendarioIdeiaStatus" NOT NULL DEFAULT 'draft',
  "approved_at" TIMESTAMP(3),
  "rejected_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "calendario_ideias_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "calendario_ideias_cliente_id_month_key_idx" ON "calendario_ideias"("cliente_id", "month_key");
CREATE INDEX IF NOT EXISTS "calendario_ideias_status_idx" ON "calendario_ideias"("status");

-- FK
DO $$ BEGIN
  ALTER TABLE "calendario_ideias" ADD CONSTRAINT "calendario_ideias_cliente_id_fkey"
  FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
