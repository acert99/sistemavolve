CREATE TYPE "ContentCalendarIdeaSource" AS ENUM ('clickup', 'generated', 'manual');
CREATE TYPE "ContentCalendarIdeaStatus" AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE "content_calendar_ideas" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "client_id" UUID NOT NULL,
  "client_slug" TEXT NOT NULL,
  "month_ref" TEXT NOT NULL,
  "day_ref" DATE NOT NULL,
  "batch_id" TEXT,
  "source" "ContentCalendarIdeaSource" NOT NULL DEFAULT 'generated',
  "status" "ContentCalendarIdeaStatus" NOT NULL DEFAULT 'pending',
  "clickup_task_id" TEXT,
  "theme" TEXT,
  "hook" TEXT,
  "format" TEXT,
  "cta" TEXT,
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "content_calendar_ideas_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "content_calendar_ideas_client_id_month_ref_idx" ON "content_calendar_ideas"("client_id", "month_ref");
CREATE INDEX "content_calendar_ideas_client_id_month_ref_day_ref_idx" ON "content_calendar_ideas"("client_id", "month_ref", "day_ref");
CREATE INDEX "content_calendar_ideas_status_idx" ON "content_calendar_ideas"("status");

CREATE UNIQUE INDEX "content_calendar_ideas_client_id_clickup_task_id_key" ON "content_calendar_ideas"("client_id", "clickup_task_id");

ALTER TABLE "content_calendar_ideas" ADD CONSTRAINT "content_calendar_ideas_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
