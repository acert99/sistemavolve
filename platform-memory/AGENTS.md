# AGENTS.md

Leia primeiro `docs/PROJECT_MEMORY.md`.

## Regras obrigatórias
- Preserve a arquitetura oficial do projeto.
- Não remova a separação entre Vercel e VPS sem justificativa forte.
- Não introduza n8n, Zapier ou nova infraestrutura como peça central se o objetivo puder ser resolvido no próprio Next.js.
- Não reescreva partes grandes do projeto sem antes inspecionar o que já existe.
- Antes de mexer em rotas, confirme impacto em `/painel`, `/cliente` e `/api/site/*`.
- Antes de mexer em SEO, preserve `sitemap`, `robots`, metadata e Open Graph.
- Antes de mexer em integrações, preserve compatibilidade com ClickUp, Asaas, Autentique e Evolution API.
- Nunca exponha segredos em código versionado.
- Em caso de conflito, siga `docs/PROJECT_MEMORY.md`.

## Prioridade de execução
1. Entender a base atual.
2. Corrigir o mínimo necessário.
3. Manter compatibilidade.
4. Só depois propor melhorias.
