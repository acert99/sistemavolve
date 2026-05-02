#!/usr/bin/env bash
set -euo pipefail

# Weekly internal close for Volve.
# Calls the real weekly client reports cron endpoint (which imports ClickUp tasks),
# then sends a compact Telegram summary or logs it if Telegram is unavailable.

set -a
[ -f /opt/volve/.env ] && . /opt/volve/.env
[ -f /opt/volve/.env.telegram ] && . /opt/volve/.env.telegram
set +a

LOG_DIR="/opt/volve/logs"
LOG="$LOG_DIR/volve-kpi-weekly-close.log"
mkdir -p "$LOG_DIR"

if [[ -z "${CRON_SECRET:-}" ]]; then
  echo "[weekly-close] CRON_SECRET ausente em /opt/volve/.env" >> "$LOG"
  exit 0
fi

JSON="$(curl -fsS -H "Authorization: Bearer ${CRON_SECRET}" "https://app.volvemkt.com/api/cron/client-reports?type=weekly" || true)"
if [[ -z "$JSON" ]]; then
  echo "[weekly-close] Falha ao chamar /api/cron/client-reports?type=weekly" >> "$LOG"
  exit 0
fi

TEXT="$(JSON_PAYLOAD="$JSON" python3 - <<'PY'
import json, os
try:
    d = json.loads(os.environ.get('JSON_PAYLOAD', ''))
except Exception:
    print('Fechamento semanal — erro ao ler resposta do endpoint')
    raise SystemExit(0)

if not d.get('success'):
    print('Fechamento semanal — endpoint retornou erro')
    raise SystemExit(0)

period = f"{d.get('periodStart', '?')} a {d.get('periodEnd', '?')}"
results = d.get('results') or []
lines = [
    'Fechamento Semanal — Volve',
    '',
    f'Período: {period}',
    f"Clientes processados: {d.get('totalClients', len(results))}",
    '',
    'Relatórios atualizados',
]
if not results:
    lines.append('- nenhum cliente retornado')
else:
    for item in results[:12]:
        name = item.get('clientName', 'Cliente')
        imported = item.get('imported', 0)
        ignored = item.get('ignored', 0)
        lines.append(f'- {name}: {imported} itens importados, {ignored} ignorados')
    if len(results) > 12:
        lines.append(f'+{len(results) - 12} clientes restantes')

lines.extend(['', 'Fonte: ClickUp + relatórios Volve'])
print('\n'.join(lines))
PY
)"

if [[ -z "$TEXT" ]]; then
  echo "[weekly-close] Texto vazio; raw(first300): ${JSON:0:300}" >> "$LOG"
  exit 0
fi

if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
  echo "[weekly-close] Telegram ausente; salvando no log" >> "$LOG"
  echo "$TEXT" >> "$LOG"
  echo "---" >> "$LOG"
  exit 0
fi

TEXT="$TEXT" python3 - <<'PY' >> "$LOG" 2>&1
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
print('Fechamento semanal enviado para Telegram')
PY
