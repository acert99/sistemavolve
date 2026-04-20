# PROJECT MEMORY — Plataforma da Agência

## 1. Identidade do projeto
Este projeto é uma **plataforma operacional da agência** com uma única base de código para centralizar atendimento, propostas, contratos, cobranças, aprovações de conteúdo e presença digital pública.

O objetivo é substituir o uso fragmentado de ClickUp, WhatsApp pessoal, propostas manuais e cobrança sem automação por uma operação mais previsível, profissional e escalável.

## 2. Problema que a plataforma resolve
A operação atual sofre com:
- aprovação de entregas via WhatsApp ou e-mail, sem histórico confiável
- propostas em PDF manuais e sem rastreamento
- contratos sem assinatura digital integrada
- cobranças manuais e sem régua automática
- desalinhamento entre cliente, ClickUp e operação interna
- falta de presença digital indexável no Google

## 3. Direção principal
A direção oficial do projeto é:
- manter **site público institucional** separado da aplicação operacional
- manter **um único domínio principal** para experiência contínua do usuário
- concentrar automações no próprio **Next.js**, sem adicionar n8n ou Zapier
- operar com **infra enxuta e custo previsível**, começando pequeno e escalando só quando o volume justificar
- priorizar **valor operacional imediato** por fase, sem depender da conclusão total do sistema para já gerar utilidade

## 4. Arquitetura oficial
### 4.1 Estrutura macro
A arquitetura oficial do projeto é:
- **Site institucional** rodando na **Vercel**
- **Painel interno**, **portal do cliente**, **webhooks** e **crons** rodando em **VPS**
- **Mesmo domínio principal** para toda a experiência
- **vercel.json** funcionando como proxy reverso para `/painel`, `/cliente` e `/api/site/*`

### 4.2 Regra de ouro da arquitetura
Não transformar este projeto em uma aplicação monolítica servida inteiramente do VPS sem necessidade real.

A separação Vercel + VPS é uma decisão estrutural do projeto porque:
- mantém o site público estável e independente do VPS
- melhora SEO e indexação
- reduz risco operacional
- permite deploy público mais simples

## 5. Stack oficial
### 5.1 Camada pública
- Vercel para hospedagem do site institucional
- domínio personalizado com SSL automático
- deploy via GitHub

### 5.2 Camada de aplicação
- Next.js 14
- App Router
- TypeScript
- Tailwind
- Prisma
- NextAuth

### 5.3 Infra do VPS
- PostgreSQL 16
- Redis 7
- Evolution API
- Caddy 2
- Easypanel
- Docker / Docker Compose

### 5.4 Integrações externas
- ClickUp
- Asaas
- Autentique
- Evolution API
- Google Search Console
- Google Analytics 4 ou Plausible

## 6. Princípios técnicos não negociáveis
1. **Não usar n8n como peça central da arquitetura.**
   As automações oficiais são rotas de API e crons do próprio Next.js.

2. **Não quebrar a separação entre site público e aplicação operacional.**
   O site segue na Vercel. O operacional segue no VPS.

3. **Não indexar rotas privadas.**
   `/painel` e `/cliente` devem permanecer bloqueadas no `robots.txt`.

4. **Não expor segredos no repositório.**
   Variáveis sensíveis devem viver em `.env` e nas variáveis de ambiente da Vercel.

5. **Não trocar stack sem justificativa forte.**
   Evitar reescrita para outras stacks, frameworks ou serviços se a necessidade for apenas execução.

6. **Não recriar o projeto do zero se já existir código funcional.**
   Primeiro entender o que já existe no repositório e evoluir em cima disso.

## 7. Fluxos principais do produto
### 7.1 Aprovações de conteúdo
Fluxo oficial:
1. tarefa move no ClickUp para a coluna de envio ao cliente
2. webhook do ClickUp chama o projeto
3. o sistema cria a entrega no banco
4. envia WhatsApp com link do portal
5. cliente aprova ou pede revisão
6. o sistema devolve status e comentário ao ClickUp

### 7.2 Proposta → contrato → cobrança
Fluxo oficial:
1. equipe cria proposta no painel
2. proposta gera PDF e link único
3. cliente visualiza e aceita
4. cliente preenche dados
5. contrato é criado via Autentique
6. assinatura concluída dispara webhook
7. cobrança é criada no Asaas
8. cliente é notificado por WhatsApp

### 7.3 Régua de cobrança
Fluxo oficial de cobrança:
- D-2: lembrete amigável
- D0: aviso de vencimento no dia
- D+1: aviso de atraso compreensivo
- D+5: aviso formal de inadimplência
- pagamento confirmado: mensagem de confirmação

## 8. Módulos oficiais
### 8.1 Site institucional
- Home
- Serviços
- Portfólio
- Sobre
- Contato

### 8.2 Painel interno
- clientes
- propostas
- contratos
- cobranças
- embed do ClickUp
- log de mensagens WhatsApp
- visão financeira consolidada

### 8.3 Portal do cliente
- dashboard
- aprovações
- propostas
- financeiro
- contratos

## 9. Estrutura de repositórios esperada
### 9.1 Repositório do site
Responsável por:
- páginas públicas
- sitemap
- robots
- metadata global
- proxy reverso via `vercel.json`

### 9.2 Repositório da plataforma
Responsável por:
- login
- painel interno
- portal do cliente
- webhooks
- crons
- integrações
- camada de dados
- infra do VPS

## 10. Regras para qualquer LLM que atuar no projeto
1. Ler este arquivo antes de sugerir mudanças estruturais.
2. Preservar as decisões de arquitetura já tomadas.
3. Preferir mudanças pequenas, seguras e reversíveis.
4. Antes de criar algo novo, procurar se já existe implementação equivalente.
5. Antes de remover código, verificar dependências, rotas, integrações e impacto em produção.
6. Se houver conflito entre uma ideia nova e este arquivo, seguir este arquivo.
7. Em caso de dúvida, escolher a solução mais conservadora e documentar a decisão.
8. Nunca inventar integração, variável de ambiente ou fluxo sem antes verificar a base já existente.
9. Não substituir uma solução funcional por outra apenas por preferência do modelo.
10. Sempre respeitar o domínio principal, o proxy do `vercel.json` e a separação entre camadas.

## 11. Regras específicas de implementação
### 11.1 Site público
- manter SEO forte
- manter metadata por página
- manter Open Graph
- manter sitemap e robots atualizados
- bloquear indexação de áreas privadas

### 11.2 VPS
- manter containers de PostgreSQL, Redis, Evolution API e Caddy
- manter Caddy como camada de SSL e proxy dos subdomínios do VPS
- manter separação clara entre aplicação, infra e integrações

### 11.3 Banco de dados
As tabelas conceituais esperadas são:
- `users`
- `clients`
- `services`
- `proposals`
- `contracts`
- `charges`
- `deliveries`
- `whatsapp_logs`

### 11.4 Variáveis de ambiente críticas
Esperar, no mínimo:
- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `ASAAS_API_KEY`
- `ASAAS_WEBHOOK_TOKEN`
- `AUTENTIQUE_API_KEY`
- `AUTENTIQUE_WEBHOOK_SECRET`
- `EVOLUTION_API_URL`
- `EVOLUTION_API_KEY`
- `CLICKUP_WEBHOOK_SECRET`
- `CLICKUP_API_TOKEN`
- `CRON_SECRET`
- `REDIS_URL`
- `NEXT_PUBLIC_VPS_API_URL`

## 12. Ordem oficial de configuração
1. banco e autenticação
2. Asaas em sandbox
3. Evolution API e ClickUp
4. Autentique em sandbox
5. produção apenas no go-live

## 13. Restrições e riscos já conhecidos
### 13.1 WhatsApp
- usar chip dedicado
- manter limite de aproximadamente 100 mensagens por dia
- migrar para Meta Cloud API se o volume crescer ou houver sinal de risco

### 13.2 Autentique
- plano gratuito até 20 contratos por mês
- monitorar o volume antes de recomendar upgrade

### 13.3 VPS
- o site público não deve depender da saúde do VPS para continuar no ar
- manter backup diário do banco
- monitorar uptime

### 13.4 Proxy Vercel
- `rewrites` do `vercel.json` são parte central da arquitetura
- se houver limitação futura na Vercel, a migração deve preservar a experiência do domínio único

## 14. Próximos passos oficiais do plano
- contratar VPS de entrada com 2 vCPU e 4 GB
- conectar GitHub à Vercel
- configurar domínio e DNS
- instalar Docker e Easypanel
- subir PostgreSQL, Redis, Evolution API e Caddy
- conectar WhatsApp dedicado
- publicar landing page inicial com sitemap e robots
- cadastrar domínio no Search Console
- iniciar autenticação e cadastro de clientes no Next.js

## 15. Como agir ao revisar código já existente
Como o projeto já teve bastante código gerado antes deste arquivo:
- não presumir que falta tudo
- começar pela leitura da estrutura atual do repositório
- mapear o que já está pronto, parcial ou quebrado
- comparar o código existente com este documento
- corrigir desvios sem refatoração agressiva
- documentar qualquer decisão que altere a arquitetura oficial

## 16. Critério de sucesso
O projeto está no caminho certo quando:
- o site institucional está publicado e indexável
- painel e portal funcionam no mesmo domínio via proxy
- propostas, contratos e cobranças fluem com menos intervenção manual
- clientes conseguem aprovar entregas e acompanhar histórico
- a operação depende menos de WhatsApp pessoal e menos de processos artesanais

## 17. Estado atual consolidado — Abril de 2026
### 17.1 Domínios e operação real
No estado atual validado do projeto:
- `volvemkt.com` atende a camada institucional pública
- `app.volvemkt.com` atende a aplicação operacional interna e o portal do cliente
- o painel em produção roda em VPS com Docker
- o repositório Git conectado ao ambiente de produção é `acert99/sistemavolve`

### 17.2 Módulo de tarefas já implantado
O módulo `/painel/tarefas` não usa mais embed como camada principal de operação.

A decisão atual do projeto é:
- usar ClickUp como fonte de verdade em tempo real
- classificar tarefas no servidor
- exibir uma **fila de atenção**
- manter o quadro/embed apenas como aba complementar

O comportamento funcional esperado hoje é:
- visualizações `Toda Operacao`, `Volve` e `Volve Health`
- leitura consolidada das duas verticais logo na abertura
- filtros por cliente
- agrupamento por urgência e prazo
- ações ligadas ao ClickUp sem espelhamento completo no banco

### 17.3 CRM / Comercial implementado
O projeto agora possui um CRM nativo em `/painel/clientes` e uma página de métricas em `/painel/comercial`.

Escopo funcional atual do CRM:
- pipeline comercial nativo
- lista de leads
- detalhe completo do lead
- timeline comercial
- follow-up automático por WhatsApp
- integração com propostas
- conversão de lead em cliente ativo
- alertas comerciais no dashboard principal

### 17.4 Estruturas de dados comerciais já adotadas
As entidades comerciais reais do projeto agora incluem:
- `leads`
- `lead_timeline`
- `follow_up_jobs`

Além disso:
- `propostas` pode existir vinculada a `lead` antes de existir `cliente`
- `templates_mensagem` também atende templates do CRM por etapa

### 17.5 Fluxo comercial oficial atualizado
Fluxo operacional que deve ser preservado:
1. lead entra no CRM
2. equipe move o lead por etapa no pipeline
3. proposta pode ser criada a partir do lead
4. envio da proposta move o lead para `proposal`
5. cadência de follow-up é criada automaticamente
6. resposta do lead cancela os jobs pendentes
7. aceite de proposta ou assinatura vinculada converte o lead para `won`
8. cliente é criado no sistema e passa a integrar a operação normal

### 17.6 Integrações já conectadas ao CRM
O CRM atual já conversa com:
- propostas internas
- webhook da Evolution / WhatsApp recebido
- webhook da Autentique
- camada de clientes ativos
- dashboard principal do painel

### 17.7 Regra de deploy atual
O deploy operacional atual deve seguir a prática já validada no VPS:
- código publicado no diretório `/opt/volve`
- build da aplicação pelo `docker-compose`
- recriação controlada do container do app
- validação por resposta HTTP após subida

Antes de qualquer publicação:
- criar backup operacional do estado anterior
- não versionar arquivos de backup e artefatos temporários
- evitar sobrescrever mudanças não relacionadas sem inspeção

### 17.8 Regra de versionamento atual
O GitHub contém a base oficial do projeto, mas o ambiente de produção pode ficar temporariamente à frente do remoto.

A regra prática atual é:
- inspecionar o estado do repositório em `/opt/volve`
- separar mudanças relevantes em commits coerentes
- não incluir backups, `.bak`, dumps ou artefatos de deploy
- subir para o GitHub apenas código, configuração e documentação úteis

### 17.9 Arquivos de memória e documentação
Este arquivo deve ser mantido sempre que houver mudança estrutural relevante em:
- módulos principais
- fluxo comercial
- fluxo de tarefas
- estratégia de deploy
- arquitetura de integração entre painel, cliente e serviços externos
