#!/usr/bin/env bash
set -euo pipefail

# Generates a ClickUp operational summary (morning/eod) by calling the app cron endpoint.
# If Telegram is not configured, it appends the summary to /opt/volve/logs/volve-kpi-daily.log.

MODE="${1:-morning}"

set -a
[ -f /opt/volve/.env ] && . /opt/volve/.env
[ -f /opt/volve/.env.telegram ] && . /opt/volve/.env.telegram
set +a

LOG_DIR="/opt/volve/logs"
LOG="$LOG_DIR/volve-kpi-daily.log"
mkdir -p "$LOG_DIR"

if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "[volve-kpi-daily] CRON_SECRET ausente em /opt/volve/.env" >> "$LOG"
  exit 0
fi

JSON="$(curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" "https://app.volvemkt.com/api/cron/clickup-summary?mode=${MODE}" || true)"
if [[ -z "$JSON" ]]; then
  echo "[volve-kpi-daily] Falha ao chamar /api/cron/clickup-summary (sem resposta)" >> "$LOG"
  exit 0
fi

MARKDOWN="$(python3 -c "import json,sys; d=json.loads(sys.stdin.read()); print((d.get('markdown') or '').strip())" <<<"$JSON" 2>/dev/null || true)"

if [[ -z "$MARKDOWN" ]]; then
  echo "[volve-kpi-daily] Resposta sem markdown (provavel erro)." >> "$LOG"
  echo "[volve-kpi-daily] Raw(first300): ${JSON:0:300}" >> "$LOG"
  exit 0
fi

# Se não tiver Telegram configurado, pelo menos registra o KPI no log
if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
  echo "[volve-kpi-daily] KPI gerado (mode=${MODE}), mas TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID ausentes; salvando no log" >> "$LOG"
  echo "$MARKDOWN" >> "$LOG"
  echo "---" >> "$LOG"
  exit 0
fi

# Envia para Telegram
python3 - <<'PY' TEXT="$MARKDOWN" >> "$LOG" 2>&1
import os,urllib.request,urllib.parse
bot=os.environ['TELEGRAM_BOT_TOKEN'].strip()
chat=os.environ['TELEGRAM_CHAT_ID'].strip()
text=os.environ.get('TEXT','')
data=urllib.parse.urlencode({
  'chat_id': chat,
  'text': text[:3900],
  'disable_web_page_preview': 'true',
}).encode()
urllib.request.urlopen(f'https://api.telegram.org/bot{bot}/sendMessage', data=data, timeout=30).read()
print('KPI enviado para Telegram')
PY

