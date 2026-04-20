# Variaveis obrigatorias da release

Este arquivo resume apenas o que precisa estar correto para a release do painel operacional com comunicacao no ambiente Docker da VPS.

## Arquivo fonte

Preencha no arquivo raiz:

```text
/opt/volve/.env
```

O `docker-compose.yml` injeta essas variaveis no container `app`.

## Obrigatorias

### Infraestrutura base

```env
POSTGRES_PASSWORD=
REDIS_PASSWORD=
NEXTAUTH_SECRET=
```

### Evolution / WhatsApp

```env
EVOLUTION_API_KEY=
```

### Asaas

```env
ASAAS_API_KEY=
ASAAS_WEBHOOK_TOKEN=
```

### Autentique

```env
AUTENTIQUE_API_KEY=
AUTENTIQUE_WEBHOOK_SECRET=
```

### ClickUp

```env
CLICKUP_API_TOKEN=
CLICKUP_TEAM_ID=
CLICKUP_WEBHOOK_SECRET=
```

### Cron existente

```env
CRON_SECRET=
```

## Opcionais com default no compose

```env
ASAAS_API_URL=https://api.asaas.com/v3
AUTENTIQUE_API_URL=https://api.autentique.com.br/v2/graphql
EVOLUTION_INSTANCE_NAME=volve
NEXT_PUBLIC_SITE_URL=https://volvemkt.com
```

## Derivadas do compose

Estas ja estao definidas no `docker-compose.yml` e nao precisam ser digitadas no `.env` raiz:

```text
DATABASE_URL=postgresql://volve:${POSTGRES_PASSWORD}@postgres:5432/volve
REDIS_URL=redis://:${REDIS_PASSWORD}@redis:6379
NEXTAUTH_URL=https://app.volvemkt.com
EVOLUTION_API_URL=http://evolution-api:8080
NEXT_PUBLIC_VPS_API_URL=https://app.volvemkt.com
```

## Observacoes operacionais

- `CLICKUP_API_TOKEN` e `CLICKUP_TEAM_ID` impactam a auditoria mostrada em `/painel/tarefas`.
- `EVOLUTION_API_KEY` impacta o status e a abertura do fluxo manual de conexao em `/painel/comunicacao`.
- `ASAAS_*`, `AUTENTIQUE_*` e `CLICKUP_WEBHOOK_SECRET` nao sao novidade desta release, mas continuam obrigatorios para as integracoes ja existentes no produto.
- `CRON_SECRET` continua obrigatorio para o cron de cobrancas. Ele nao ativa disparo automatico das `mensagens_agendadas`.
