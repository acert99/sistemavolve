CREATE TYPE "ClientReportType" AS ENUM ('weekly', 'monthly');
CREATE TYPE "ClientReportStatus" AS ENUM ('draft', 'reviewed', 'approved', 'sent');
CREATE TYPE "ClientReportItemType" AS ENUM ('published_content', 'pending_client', 'in_progress', 'highlight', 'risk', 'next_action', 'delayed', 'strategic_note');
CREATE TYPE "ClientReportAssetType" AS ENUM ('markdown', 'pdf', 'json', 'image');
CREATE TYPE "ClientReportSource" AS ENUM ('manual', 'clickup', 'api');
CREATE TYPE "ClientReportServiceType" AS ENUM ('content', 'paid_traffic', 'medical', 'institutional', 'event', 'custom');

CREATE TABLE "client_reports" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "type" "ClientReportType" NOT NULL,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "month_ref" INTEGER,
  "year_ref" INTEGER,
  "status" "ClientReportStatus" NOT NULL DEFAULT 'draft',
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "highlights" TEXT,
  "risks" TEXT,
  "next_steps" TEXT,
  "internal_notes" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "approved_at" TIMESTAMP(3),
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_reports_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_report_metrics" (
  "id" TEXT NOT NULL,
  "report_id" TEXT NOT NULL,
  "metric_key" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "value" DECIMAL(14,4),
  "previous_value" DECIMAL(14,4),
  "variation_absolute" DECIMAL(14,4),
  "variation_percent" DECIMAL(14,4),
  "unit" TEXT,
  "source" "ClientReportSource" NOT NULL DEFAULT 'manual',
  "notes" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_report_metrics_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_report_items" (
  "id" TEXT NOT NULL,
  "report_id" TEXT NOT NULL,
  "type" "ClientReportItemType" NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "date" DATE,
  "status" TEXT,
  "source" "ClientReportSource" NOT NULL DEFAULT 'manual',
  "source_task_id" TEXT,
  "source_task_url" TEXT,
  "content_url" TEXT,
  "order_index" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_report_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_report_assets" (
  "id" TEXT NOT NULL,
  "report_id" TEXT NOT NULL,
  "type" "ClientReportAssetType" NOT NULL,
  "filename" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "public_url" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_report_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_report_profiles" (
  "id" TEXT NOT NULL,
  "client_id" TEXT NOT NULL,
  "report_tone" TEXT,
  "service_type" "ClientReportServiceType" NOT NULL DEFAULT 'content',
  "promised_frequency" INTEGER,
  "main_channels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "primary_goals" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "important_notes" TEXT,
  "metrics_enabled" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "template_variant" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "client_report_profiles_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "client_reports_client_id_type_period_start_idx" ON "client_reports"("client_id", "type", "period_start");
CREATE INDEX "client_reports_status_idx" ON "client_reports"("status");
CREATE UNIQUE INDEX "client_report_metrics_report_id_metric_key_key" ON "client_report_metrics"("report_id", "metric_key");
CREATE INDEX "client_report_items_report_id_type_idx" ON "client_report_items"("report_id", "type");
CREATE INDEX "client_report_items_source_task_id_idx" ON "client_report_items"("source_task_id");
CREATE INDEX "client_report_assets_report_id_type_idx" ON "client_report_assets"("report_id", "type");
CREATE UNIQUE INDEX "client_report_profiles_client_id_key" ON "client_report_profiles"("client_id");

ALTER TABLE "client_reports" ADD CONSTRAINT "client_reports_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_report_metrics" ADD CONSTRAINT "client_report_metrics_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "client_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_report_items" ADD CONSTRAINT "client_report_items_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "client_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_report_assets" ADD CONSTRAINT "client_report_assets_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "client_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_report_profiles" ADD CONSTRAINT "client_report_profiles_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clientes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
