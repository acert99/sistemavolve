# Features / Log (auditável)

Este arquivo é o “ledger” local de features/decisões relevantes para operação. Objetivo: evitar perda de contexto e perguntas repetidas.

## 2026-04-30 — Automação: diagnóstico e hardening

- **Incidente:** KPI/briefing/rotinas não rodaram.
- **Causa raiz:** `crontab` do root chamava scripts em `/opt/volve/scripts/*`, mas o diretório `/opt/volve/scripts` foi apagado.
- **Arquitetura atual (VPS):**
  - Endpoints Next.js de cron: `/api/cron/clickup-summary`, `/api/cron/scheduled-messages`, `/api/cron/cobrancas`, `/api/cron/follow-up`
  - Autenticação via `Authorization: Bearer <CRON_SECRET>`
  - Agendamentos via `crontab` do root (curl para endpoints + scripts locais para KPI/relatórios)
- **Documento auditável criado:** `docs/ops/vps-audit-2026-04-30.md`

Correções aplicadas no VPS (sem depender de ação manual do Albert):
- `/opt/volve/scripts` restaurado.
- Calendário de conteúdo redeployado (runner mensal voltou a existir).
- `volve-kpi-daily.sh` reinstalado e ajustado para **gerar** o relatório via `/api/cron/clickup-summary` e, se Telegram não estiver configurado, **persistir no log**.
- Criado endpoint `/api/cron/client-reports` e cron do VPS ajustado para chamá-lo (relatórios semanais).
- `saveReportAsset` alterado para persistir assets em `/app/reports/...` (volume) e `docker-compose.yml` ajustado para montar `./reports:/app/reports` (rw).

Pendências registradas:
- `volve-client-reports.sh` e `volve-kpi-weekly-close.sh` precisam ser restaurados com a implementação original (não estão no repo).
- `/opt/volve/.env.telegram` estava ausente na data do audit; depois foi recriado no VPS e o envio do KPI por Telegram foi validado.

## 2026-05-01 — Hardening e formato das mensagens operacionais

- Criado documento auditável: `docs/ops/security-hardening.md`.
- Decisão de formato:
  - Manhã: duas mensagens separadas — **KPI de Posts** e **Briefing do Dia**.
  - KPI deve ser somente métrica de posts por cliente contra meta.
  - Briefing deve ordenar execução do dia: tarefas de hoje primeiro, depois atrasadas, bloqueadas/cobranças.
  - Fechamento do dia às **18:39 BRT**.
  - Fechamento não deve sugerir “ação agora”; deve consolidar estado final, pendências e riscos para amanhã.
  - Segunda-feira: briefing semanal separado.
- Implementação: `/api/cron/clickup-summary` aceita `type=kpi`, `type=briefing` e `type=closing`; `volve-kpi-daily.sh` envia duas mensagens de manhã e fechamento no fim do dia.

Recomendações registradas:
- Migrar scheduler para GitHub Actions (schedule) chamando `/api/cron/*` com secrets, ou
- Versionar scripts de `/opt/volve/scripts` no repo + deploy idempotente.
