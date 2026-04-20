# Release da Plataforma Volve: painel operacional + comunicacao

Escopo desta release:
- nova base visual compartilhada e sidebar reorganizada
- dashboard como centro operacional
- modulo `Tarefas`
- modulo `Comunicacao`
- APIs em `src/app/api/communication`
- persistencia nova em `app/prisma/add-communication.sql`

Observacoes importantes:
- O build local no drive `M:` pode falhar com `EISDIR`. Isso e limitacao do ambiente Windows/mapeamento, nao do codigo.
- Para validacao local confiavel, use copia temporaria fora do drive mapeado.
- Para deploy, prefira build no Linux da VPS.
- Os exemplos abaixo usam `docker-compose` porque o historico do ambiente de producao ja utilizou a versao v1.29.2. Se a VPS estiver com Compose v2, substitua por `docker compose`.

## Pre deploy

1. Confirmar que o codigo da release esta presente em `/opt/volve`.
2. Fazer backup do `.env` atual:
   ```bash
   cd /opt/volve
   cp .env .env.backup-$(date +%Y%m%d-%H%M%S)
   ```
3. Fazer backup logico do banco antes de aplicar SQL:
   ```bash
   cd /opt/volve
   docker-compose exec -T postgres pg_dump -U volve volve > backup-pre-communication-$(date +%Y%m%d-%H%M%S).sql
   ```
4. Validar que o `.env` contem todas as variaveis obrigatorias desta release.
5. Validar que `app.volvemkt.com` e `evolution.volvemkt.com` continuam apontando para a VPS.
6. Validar que os containers-base estao saudaveis antes de mexer:
   ```bash
   cd /opt/volve
   docker-compose ps
   ```

## Ordem correta desta release

1. Sincronizar o codigo da release na VPS.
2. Conferir o `.env`.
3. Aplicar `app/prisma/add-communication.sql` no banco existente.
4. Rebuildar a imagem do app.
5. Recriar apenas o container do app.
6. Validar logs e rotas.

Motivo da ordem:
- o modulo de comunicacao depende das novas tabelas imediatamente no runtime
- se o app novo subir antes do SQL, `/painel/comunicacao` e as APIs de comunicacao podem responder `500`
- o dashboard tem degradacao parcial, mas a pagina de comunicacao nao

## Deploy

### 1. Aplicar a SQL obrigatoria da release

```bash
cd /opt/volve
docker-compose exec -T postgres psql -U volve -d volve < app/prisma/add-communication.sql
```

Se este ambiente ainda nao tiver recebido o alinhamento antigo de enums, aplique antes:

```bash
cd /opt/volve
docker-compose exec -T postgres psql -U volve -d volve < app/prisma/align-enums.sql
```

`align-enums.sql` nao e o passo central desta release. Ele so entra se o banco legado ainda estiver fora do formato esperado pelo Prisma.

### 2. Rebuildar a imagem do app

```bash
cd /opt/volve
docker-compose build app
```

Notas:
- o `next.config.js` desta release usa `output: 'standalone'`, alinhado ao `Dockerfile`
- o Prisma Client e regenerado durante o processo de build/dependencias do container; nao e necessario rodar `prisma generate` manualmente na VPS se a imagem foi rebuildada

### 3. Recriar apenas o app

No historico da VPS houve bug do `docker-compose` v1.29.2 (`KeyError: 'ContainerConfig'`) ao recriar containers. Use este caminho:

```bash
cd /opt/volve
docker ps -a --format '{{.Names}}' | grep 'volve_app' | xargs -r docker rm -f
docker-compose up -d --no-deps app
```

### 4. Validar que o app subiu

```bash
cd /opt/volve
docker-compose ps
docker-compose logs --tail=100 app
```

## Pos deploy

1. Abrir `https://app.volvemkt.com/auth/login`.
2. Fazer login com usuario de equipe valido.
3. Abrir `/painel`.
4. Abrir `/painel/tarefas`.
5. Abrir `/painel/comunicacao`.
6. Testar:
   - consulta de status do WhatsApp
   - criacao de template
   - criacao de mensagem agendada
   - edicao de mensagem agendada
   - cancelamento de mensagem agendada
7. Verificar logs:
   ```bash
   cd /opt/volve
   docker-compose logs --tail=100 app
   docker-compose logs --tail=50 caddy
   docker-compose logs --tail=50 evolution-api
   ```

## Rollback

Esta release adiciona tabelas novas, mas nao altera comportamento destrutivo do schema existente. Em caso de rollback do app:
- o banco pode permanecer com as tabelas novas
- nao e obrigatorio restaurar o backup SQL para voltar a versao anterior do app

Sequencia sugerida:

1. Restaurar o codigo anterior da aplicacao em `/opt/volve/app`.
2. Rebuildar a imagem antiga:
   ```bash
   cd /opt/volve
   docker-compose build app
   ```
3. Recriar o container do app com o mesmo workaround:
   ```bash
   cd /opt/volve
   docker ps -a --format '{{.Names}}' | grep 'volve_app' | xargs -r docker rm -f
   docker-compose up -d --no-deps app
   ```
4. Validar login e dashboard.

So restaure o backup completo do banco se houver corrupcao de dados ou necessidade explicita de reverter estrutura, porque o rollback normal desta release e apenas de aplicacao.

## O que esta operacional vs. o que continua dependente de infraestrutura

Ja operacional no codigo/UI:
- leitura do status da Evolution
- persistencia de canal WhatsApp
- criacao e listagem de templates
- criacao, edicao e cancelamento de mensagens agendadas

Ainda dependente de infraestrutura externa:
- leitura do QR code e conexao manual da instância no manager da Evolution
- execucao automatica de `mensagens_agendadas` por horario

Hoje existe cron apenas para cobrancas em `/api/cron/cobrancas`. Nao existe worker, cron ou scheduler implementado para despachar `mensagens_agendadas`.
