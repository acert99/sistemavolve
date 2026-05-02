# Security hardening — automações Volve

Data: 2026-05-01

Este documento registra decisões de segurança/hardening aplicadas ou pendentes nas automações do VPS Volve.

## Escopo

- VPS do app Volve: `188.245.70.244`
- App/repo: `acert99/sistemavolve`
- Caminho de produção: `/opt/volve`
- Automações afetadas:
  - KPI de Posts
  - Briefing diário
  - Fechamento do dia
  - Briefing semanal
  - Relatórios semanais
  - Cobranças
  - Mensagens agendadas
  - Calendário de conteúdo

## Decisões aplicadas

### 1. Secrets fora do crontab

Problema encontrado:
- O `crontab` do root continha chamadas `curl` com `Authorization: Bearer <CRON_SECRET>` inline.

Correção aplicada:
- Criados wrappers em `/opt/volve/scripts/cron-*.sh`.
- Os wrappers carregam `CRON_SECRET` de `/opt/volve/.env`.
- O `crontab` passou a chamar os wrappers, sem expor o secret diretamente.

Wrappers confirmados:
- `/opt/volve/scripts/cron-cobrancas.sh`
- `/opt/volve/scripts/cron-scheduled-messages.sh`
- `/opt/volve/scripts/cron-client-reports.sh`

### 2. Scripts versionáveis / auditáveis

Problema encontrado:
- `/opt/volve/scripts` foi apagado e quebrou automações.
- Os scripts não estavam totalmente versionados no repo.

Correção aplicada/parcial:
- Diretório `/opt/volve/scripts` restaurado.
- Scripts críticos recriados.
- Documentação auditável criada em:
  - `docs/ops/vps-audit-2026-04-30.md`
  - `docs/FEATURES.md`

Recomendação:
- Versionar scripts operacionais em `scripts/` ou `ops/vps-scripts/`.
- Criar deploy idempotente para recriar `/opt/volve/scripts` sempre que necessário.

### 3. Telegram bot token

Problema encontrado:
- `/opt/volve/.env.telegram` estava ausente.
- KPI gerava, mas não enviava para Telegram.

Correção aplicada:
- `/opt/volve/.env.telegram` recriado no VPS.
- `volve-kpi-daily.sh` corrigido e testado.
- Log confirmou envio: `KPI enviado para Telegram`.

Importante:
- O token foi fornecido em conversa. Por segurança, recomenda-se rotacionar o token no BotFather.
- Nunca registrar token em memória, docs, logs ou Git.

### 4. Persistência de assets de relatórios

Problema encontrado:
- O app tentou gravar assets em caminho sem permissão (`EACCES`).

Correção aplicada:
- Assets de relatórios passaram a ser gravados em `/app/reports/generated/reports/...`.
- Volume do Docker ajustado para `./reports:/app/reports` com escrita habilitada.
- Permissões de `/opt/volve/reports` ajustadas para o usuário do container.

### 5. Separação lógica das mensagens

Decisão de produto/operação:
- Pela manhã devem sair **duas mensagens separadas**:
  1. KPI de Posts — somente métricas.
  2. Briefing do Dia — execução/prioridades do dia.
- Fechamento do dia deve sair às **18:39 BRT**.
- Fechamento não deve pedir “ação agora”; deve registrar estado final, pendências e riscos para amanhã.
- Segunda-feira deve haver briefing semanal separado.

Implementação no app:
- `/api/cron/clickup-summary?mode=morning&type=kpi` gera o **KPI de Posts**.
- `/api/cron/clickup-summary?mode=morning&type=briefing` gera o **Briefing do Dia**.
- `/api/cron/clickup-summary?mode=eod&type=closing` gera o **Fechamento do Dia**.
- `/opt/volve/scripts/volve-kpi-daily.sh morning` envia duas mensagens separadas: KPI + briefing.
- `/opt/volve/scripts/volve-kpi-daily.sh eod` envia o fechamento.

Fonte da meta semanal do KPI:
- A meta de posts por cliente vem da descrição da lista no ClickUp.
- Campo esperado: `kpi_posts_semana: N`.
- Se `N = 0`, a lista não entra na meta de posts.
- A lista template `DUPLIQUE ESSA LISTA` é ignorada explicitamente.

## Estado atual conhecido

### Funcionando

- Acesso SSH validado ao VPS.
- `/opt/volve/scripts` restaurado.
- KPI consegue gerar via `/api/cron/clickup-summary`.
- Envio Telegram do KPI foi validado após recriar `/opt/volve/.env.telegram`.
- Endpoint `/api/cron/client-reports` criado e testado com HTTP 200.
- Relatórios conseguem gerar assets em `/opt/volve/reports/generated/reports`.
- Crons de cobranças e mensagens agendadas usam wrappers sem secret inline.

### Pendências

- Implementar a nova formatação final das mensagens:
- Refinar o Briefing Semanal de segunda como mensagem própria (hoje reaproveita o script da manhã).
- Revisar/restaurar completamente scripts antigos:
  - `volve-client-reports.sh`
  - `volve-kpi-weekly-close.sh`
- Rotacionar token do bot no BotFather.
- Commitar/versionar docs e scripts no Git.
- Opcional: migrar scheduler para GitHub Actions para histórico auditável de runs.

## Checklist de auditoria rápida

No VPS:

```bash
crontab -l
ls -la /opt/volve/scripts
ls -la /opt/volve/.env /opt/volve/.env.telegram
ls -la /opt/volve/reports/generated/reports
```

Logs principais:

```bash
tail -n 100 /opt/volve/logs/volve-kpi-daily.log
tail -n 100 /var/log/volve-client-reports.log
tail -n 100 /var/log/volve-cron.log
tail -n 100 /var/log/volve-scheduled.log
```

## Regra operacional daqui para frente

Toda nova automação precisa registrar:

- nome da automação;
- horário e timezone;
- origem dos dados;
- destino da mensagem;
- script/endpoint responsável;
- arquivo de log;
- secrets usados, sem expor valores;
- forma de testar manualmente;
- rollback simples.
