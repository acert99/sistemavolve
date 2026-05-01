#!/usr/bin/env bash
set -euo pipefail

# Sends Volve operational bot messages.
# morning: sends two separate messages (KPI de Posts + Briefing do Dia)
# eod: sends Fechamento do Dia

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

send_text() {
  local text="$1"

  if [[ -z "$text" ]]; then
    echo "[volve-kpi-daily] Texto vazio; nada enviado" >> "$LOG"
    return 0
  fi

  if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
    echo "[volve-kpi-daily] TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID ausentes; salvando no log" >> "$LOG"
    echo "$text" >> "$LOG"
    echo "---" >> "$LOG"
    return 0
  fi

  TEXT="$text" python3 - <<'PY' >> "$LOG" 2>&1
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
print('Mensagem enviada para Telegram')
PY
}

fetch_markdown() {
  local mode="$1"
  local type="$2"
  local json markdown

  json="$(curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" "https://app.volvemkt.com/api/cron/clickup-summary?mode=${mode}&type=${type}" || true)"
  if [[ -z "$json" ]]; then
    echo "[volve-kpi-daily] Falha ao chamar /api/cron/clickup-summary?mode=${mode}&type=${type}" >> "$LOG"
    return 0
  fi

  markdown="$(python3 -c "import json,sys; d=json.loads(sys.stdin.read()); print((d.get('markdown') or '').strip())" <<<"$json" 2>/dev/null || true)"
  if [[ -z "$markdown" ]]; then
    echo "[volve-kpi-daily] Resposta sem markdown (mode=${mode}, type=${type})." >> "$LOG"
    echo "[volve-kpi-daily] Raw(first300): ${json:0:300}" >> "$LOG"
    return 0
  fi

  printf '%s' "$markdown"
}

case "$MODE" in
  morning)
    send_text "$(fetch_markdown morning kpi)"
    send_text "$(fetch_markdown morning briefing)"
    ;;
  eod|closing)
    send_text "$(fetch_markdown eod closing)"
    ;;
  *)
    echo "[volve-kpi-daily] Modo invalido: $MODE" >> "$LOG"
    exit 1
    ;;
esac
