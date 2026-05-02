#!/usr/bin/env bash
set -euo pipefail

# Idempotent-ish deploy of VPS automation scripts under /opt/volve/scripts.
#
# Scope (2026-04-30):
# - Restores /opt/volve/scripts + /opt/volve/logs
# - Installs:
#   - volve-kpi-daily.sh (calls /api/cron/clickup-summary)
#   - volve-kpi-weekly-close.sh (calls /api/cron/client-reports)
#   - content calendar scripts + wrapper (content-calendar-monthly-run.sh)
#
# NOTE: Telegram delivery requires /opt/volve/.env.telegram with:
#   TELEGRAM_BOT_TOKEN=
#   TELEGRAM_CHAT_ID=
# This script does NOT write secrets.

VPS_HOST="${VPS_HOST:-root@188.245.70.244}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "Deploying automations to $VPS_HOST"

ssh "$VPS_HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
install -d -m 700 /opt/volve/scripts /opt/volve/logs /opt/volve/state
install -d -m 755 /opt/volve/reports
REMOTE

scp \
  "$ROOT_DIR/scripts/volve-kpi-daily.sh" \
  "$ROOT_DIR/scripts/volve-kpi-weekly-close.sh" \
  "$ROOT_DIR/scripts/content_calendar_generate.py" \
  "$ROOT_DIR/scripts/content_calendar_render_pdf.py" \
  "$ROOT_DIR/scripts/content_calendar_monthly_run.py" \
  "$VPS_HOST:/opt/volve/scripts/"

ssh "$VPS_HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
chmod 700 \
  /opt/volve/scripts/volve-kpi-daily.sh \
  /opt/volve/scripts/volve-kpi-weekly-close.sh \
  /opt/volve/scripts/content_calendar_generate.py \
  /opt/volve/scripts/content_calendar_render_pdf.py \
  /opt/volve/scripts/content_calendar_monthly_run.py

cat > /opt/volve/scripts/content-calendar-monthly-run.sh <<'SH'
#!/usr/bin/env bash
set -euo pipefail
set -a
[ -f /opt/volve/.env ] && . /opt/volve/.env
[ -f /opt/volve/.env.telegram ] && . /opt/volve/.env.telegram
set +a
cd /opt/volve
python3 /opt/volve/scripts/content_calendar_monthly_run.py >> /opt/volve/logs/content-calendar-monthly.log 2>&1
SH
chmod 700 /opt/volve/scripts/content-calendar-monthly-run.sh

echo OK
REMOTE

echo "OK"

