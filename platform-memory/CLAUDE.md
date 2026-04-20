# CLAUDE.md

Este projeto usa `docs/PROJECT_MEMORY.md` como fonte principal de contexto.

## Sempre
- leia `docs/PROJECT_MEMORY.md` antes de propor arquitetura ou refatoração
- preserve a separação entre site público na Vercel e aplicação operacional no VPS
- mantenha o domínio principal funcionando com proxy via `vercel.json`
- evite refatorações desnecessárias
- prefira mudanças pequenas, seguras e reversíveis
- confirme o que já existe no repositório antes de criar algo novo
- preserve SEO do site público e bloqueio de indexação das áreas privadas
- preserve integrações com ClickUp, Asaas, Autentique e Evolution API
- trate `.env` e segredos como dados não versionáveis

## Nunca
- recrie o projeto do zero sem necessidade
- troque stack por preferência pessoal
- quebre `/painel`, `/cliente` ou `/api/site/*`
- mova o site público para o VPS sem motivo concreto
- adicione n8n como núcleo da operação se o próprio Next.js resolver

## Em caso de dúvida
Siga o documento de memória do projeto e escolha a solução mais conservadora.
