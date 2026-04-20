# Plataforma Volve — Agência Digital

Stack completa para agências: site público, painel interno da equipe e portal do cliente — com integrações WhatsApp (Evolution API), pagamentos (Asaas), contratos (Autentique) e gestão de tarefas (ClickUp).

## Arquitetura

```
volve.com.br          → site/   (Vercel — Next.js 14, SSR + SEO)
app.volve.com.br      → app/    (VPS — Docker, Next.js 14 + Prisma)
evolution.volve.com.br→ VPS     (Evolution API — WhatsApp Gateway)
```

```
Plataforma Volve/
├── docker-compose.yml     # PostgreSQL + Redis + Evolution API + Caddy
├── Caddyfile              # SSL automático (Let's Encrypt)
├── init.sql               # Schema inicial do banco (8 tabelas)
├── .env.example           # Variáveis Docker
├── site/                  # Site público (deploy na Vercel)
│   ├── vercel.json        # Rewrites /painel e /cliente → VPS
│   └── src/app/           # Home, Serviços, Portfólio, Sobre, Contato
└── app/                   # Painel + Portal do cliente (VPS)
    ├── prisma/schema.prisma
    ├── .env.example
    └── src/
        ├── middleware.ts          # Proteção de rotas por perfil
        ├── lib/
        │   ├── whatsapp.ts        # Evolution API
        │   ├── asaas.ts           # Gateway de pagamento
        │   ├── autentique.ts      # Assinatura eletrônica
        │   ├── clickup.ts         # Gestão de tarefas
        │   └── pdf.ts             # Geração de PDF de propostas
        └── app/
            ├── api/               # REST API com NextAuth
            ├── painel/            # Painel interno (equipe)
            ├── cliente/           # Portal do cliente
            └── propostas/[token]/ # Link público de propostas
```

---

## Checklist de produção

### 1. Pré-requisitos do VPS

```bash
# Ubuntu 22.04 LTS recomendado
# Instalar Docker + Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo apt install docker-compose-plugin -y

# Verificar instalação
docker --version
docker compose version
```

### 2. Clonar e configurar o projeto no VPS

```bash
# Clonar para o servidor
git clone https://github.com/SEU_USUARIO/plataforma-volve.git /opt/volve
cd /opt/volve

# Criar .env com as variáveis reais
cp .env.example .env
nano .env  # Preencher todos os valores

# Criar .env.local do app
cd app
cp .env.example .env.local
nano .env.local  # Preencher todos os valores
cd ..
```

### 3. Configurar DNS

No painel do seu domínio, crie os registros:

| Registro | Nome       | Valor           | TTL  |
|----------|------------|-----------------|------|
| A        | app        | IP_DO_SEU_VPS   | 300  |
| A        | evolution  | IP_DO_SEU_VPS   | 300  |

Para o site público (Vercel), configure o CNAME do domínio raiz apontando para a Vercel.

### 4. Build e subir os containers

```bash
# Build da imagem do app Next.js
cd app
npm install
npx prisma generate
cd ..

docker build -t volve-app ./app

# Subir toda a stack
docker compose up -d

# Verificar status
docker compose ps
docker compose logs -f app
```

### 5. Executar migrations do banco

```bash
# Aguardar PostgreSQL inicializar (~10s)
docker compose exec app npx prisma migrate deploy

# Opcional: visualizar dados
docker compose exec app npx prisma studio
```

### 6. Configurar webhooks externos

#### ClickUp
1. Acesse `ClickUp Settings > Integrations > Webhooks`
2. URL: `https://app.volve.com.br/api/webhooks/clickup`
3. Events: `taskStatusUpdated`
4. Copie o `webhook_secret` e cole em `CLICKUP_WEBHOOK_SECRET` no `.env.local`

#### Asaas
1. Acesse `painel.asaas.com > Configurações > Webhooks`
2. URL: `https://app.volve.com.br/api/webhooks/asaas`
3. Events: PAYMENT_RECEIVED, PAYMENT_CONFIRMED, PAYMENT_OVERDUE
4. Token de autenticação: copie para `ASAAS_WEBHOOK_TOKEN`

#### Autentique
1. Acesse o painel do Autentique > Configurações > Webhooks
2. URL: `https://app.volve.com.br/api/webhooks/autentique`
3. Copie o webhook secret para `AUTENTIQUE_WEBHOOK_SECRET`

### 7. Configurar cron job (notificações de cobrança)

```bash
# No VPS, editar o crontab do sistema
crontab -e

# Adicionar linha para executar todo dia às 9h (horário de Brasília)
0 9 * * * curl -s -H "Authorization: Bearer SEU_CRON_SECRET" \
  https://app.volve.com.br/api/cron/cobrancas >> /var/log/volve-cron.log 2>&1
```

Ou use Vercel Cron se o app estiver na Vercel (adicionar ao `vercel.json` do `app/`):
```json
{
  "crons": [{ "path": "/api/cron/cobrancas", "schedule": "0 12 * * *" }]
}
```

### 8. Configurar Evolution API (WhatsApp)

```bash
# Acessar o manager da Evolution API
# URL: https://evolution.volve.com.br/manager (em desenvolvimento)

# Criar instância via API:
curl -X POST https://evolution.volve.com.br/instance/create \
  -H "apikey: SUA_EVOLUTION_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"instanceName": "volve", "qrcode": true}'

# Conectar via QR Code — acessar o endpoint de QR:
curl https://evolution.volve.com.br/instance/qrcode/volve \
  -H "apikey: SUA_EVOLUTION_API_KEY"
```

### 9. Deploy do site público na Vercel

```bash
# Instalar Vercel CLI
npm i -g vercel

# Na pasta site/
cd site
vercel

# Configurar domínio:
vercel domains add volve.com.br

# IMPORTANTE: editar site/vercel.json
# Substituir SEU_VPS_IP pelo IP real (ex: 123.45.67.89)
# ou pelo domínio do app: https://app.volve.com.br
```

### 10. Senha inicial do admin

O `init.sql` cria um usuário admin com:
- **E-mail:** `admin@volve.com.br`
- **Senha:** `Volve@2025`

**⚠️ Troque a senha imediatamente após o primeiro login!**

Para criar novos usuários da equipe:
```sql
-- Via psql ou Prisma Studio
INSERT INTO usuarios (nome, email, senha_hash, perfil)
VALUES (
  'Nome Completo',
  'usuario@volve.com.br',
  '$2b$12$...bcrypt_hash...',
  'equipe'
);
```

Ou use a lib bcrypt para gerar o hash:
```js
const bcrypt = require('bcryptjs')
const hash = await bcrypt.hash('SenhaSegura123!', 12)
console.log(hash)
```

Para criar usuário de cliente:
```sql
-- Primeiro crie o cliente na tabela clientes
-- Depois crie o usuário vinculado
INSERT INTO usuarios (nome, email, senha_hash, perfil, cliente_id)
VALUES ('Nome Cliente', 'cliente@email.com', '$2b$12$...', 'cliente', 'UUID_DO_CLIENTE');
```

---

## Variáveis de ambiente (app/.env.local)

| Variável                    | Descrição                                          |
|-----------------------------|---------------------------------------------------|
| `DATABASE_URL`              | URL do PostgreSQL                                  |
| `NEXTAUTH_SECRET`           | Secret do NextAuth (gere com `openssl rand -base64 32`) |
| `NEXTAUTH_URL`              | URL pública do app (ex: https://app.volve.com.br)  |
| `ASAAS_API_KEY`             | API Key do Asaas (começa com `$aact_`)             |
| `ASAAS_WEBHOOK_TOKEN`       | Token de validação de webhooks Asaas               |
| `ASAAS_API_URL`             | URL da API Asaas (sandbox ou produção)             |
| `AUTENTIQUE_API_KEY`        | Bearer token da API Autentique                     |
| `AUTENTIQUE_WEBHOOK_SECRET` | Secret para validação de webhooks Autentique       |
| `EVOLUTION_API_URL`         | URL pública da Evolution API                       |
| `EVOLUTION_API_KEY`         | API Key da Evolution API                           |
| `EVOLUTION_INSTANCE_NAME`   | Nome da instância WhatsApp (padrão: `volve`)       |
| `CLICKUP_WEBHOOK_SECRET`    | Secret para validação HMAC dos webhooks ClickUp    |
| `CLICKUP_API_TOKEN`         | Personal token do ClickUp (`pk_...`)               |
| `CLICKUP_TEAM_ID`           | ID do workspace ClickUp                            |
| `CRON_SECRET`               | Secret para autenticar chamadas de cron            |
| `REDIS_URL`                 | URL do Redis                                       |
| `NEXT_PUBLIC_VPS_API_URL`   | URL pública do app (para links em e-mails/WhatsApp)|

---

## Módulos implementados

| Módulo        | Rota (API)              | Rota (UI Equipe)        | Rota (UI Cliente)       |
|---------------|-------------------------|-------------------------|-------------------------|
| Clientes      | `/api/clientes`         | `/painel/clientes`      | —                       |
| Serviços      | `/api/servicos`         | `/painel/servicos`      | —                       |
| Aprovações    | `/api/aprovacoes`       | `/painel/aprovacoes`    | `/cliente/aprovacoes`   |
| Propostas     | `/api/propostas`        | `/painel/propostas`     | `/cliente/propostas`    |
| Contratos     | `/api/contratos`        | `/painel/contratos`     | `/cliente/contratos`    |
| Cobranças     | `/api/cobrancas`        | `/painel/cobrancas`     | `/cliente/financeiro`   |
| Proposta pública | —                    | —                       | `/propostas/[token]`    |

### Webhooks

| Webhook     | Rota                           | Integração  |
|-------------|--------------------------------|-------------|
| ClickUp     | `/api/webhooks/clickup`        | HMAC-SHA256 |
| Asaas       | `/api/webhooks/asaas`          | Token header|
| Autentique  | `/api/webhooks/autentique`     | HMAC-SHA256 |

### Cron

| Job                    | Rota                      | Schedule     |
|------------------------|---------------------------|--------------|
| Notificações cobranças | `/api/cron/cobrancas`     | Diário 9h    |

---

## Comandos úteis

```bash
# Logs do app em tempo real
docker compose logs -f app

# Reiniciar apenas o app (após atualização)
docker compose build app && docker compose up -d app

# Backup do banco de dados
docker compose exec postgres pg_dump -U volve volve > backup_$(date +%Y%m%d).sql

# Restaurar backup
docker compose exec -T postgres psql -U volve volve < backup_20240101.sql

# Acessar shell do banco
docker compose exec postgres psql -U volve volve

# Ver status da instância WhatsApp
curl https://evolution.volve.com.br/instance/connectionState/volve \
  -H "apikey: SUA_EVOLUTION_API_KEY"
```

---

## Próximos passos sugeridos

- [ ] Upload de arquivos para S3/R2/Supabase Storage (propostas PDF, entregas)
- [ ] Notificações push (PWA) para o portal do cliente
- [ ] Dashboard de métricas financeiras com gráficos (Recharts)
- [ ] Sistema de tags e categorias para clientes
- [ ] Integração com Google Calendar para agendamentos
- [ ] App mobile via Capacitor ou React Native
- [ ] Painel de relatórios com exportação CSV/Excel

---

## Suporte

**Volve Agência Digital**  
contato@volve.com.br  
volve.com.br
