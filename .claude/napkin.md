# Napkin Runbook

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)
1. **[2026-04-20] NextAuth v5 em produção usa cookie `__Secure-authjs.session-token`**
   Do instead: em middleware com `getToken`, passar `secureCookie: true` quando a request/`NEXTAUTH_URL` for HTTPS; sem isso o middleware não lê a sessão e cria loop `/` ↔ `/superadmin`.

2. **[2026-04-05] Monorepo pnpm — scripts ficam na raiz**
   Do instead: usar `pnpm dev:web`, `pnpm build:web`, `pnpm typecheck:web` da raiz. Python services rodam independentemente via uvicorn.

3. **[2026-04-10] Node 22 quebra o `next dev` com Web Storage experimental**
   Do instead: subir o web com `NODE_OPTIONS=--no-experimental-webstorage` em `dev`, `build`, `start` e no Docker para evitar `localStorage.getItem is not a function`.

4. **[2026-04-20] Produção usa PostgreSQL via `DATABASE_URL` para stores do Next**
   Do instead: no Dokploy, configurar `DATABASE_URL` apontando para o serviço PG interno; os JSON stores do Next persistem na tabela `app_documents`, com fallback local só sem `DATABASE_URL`.

## Shell & Command Reliability
1. **[2026-04-05] pnpm 10.30.0 é o package manager**
   Do instead: sempre usar `pnpm` (não npm/yarn). Workspace definido em `pnpm-workspace.yaml` com `apps/*` e `packages/*`.

2. **[2026-04-05] Python services requerem >= 3.12**
   Do instead: usar `python3` e verificar versão antes de rodar serviços FastAPI.

## Domain Behavior Guardrails
1. **[2026-04-05] Multi-tenant: isolamento por tenant é princípio core**
   Do instead: todo dado, asset e job deve ser isolado por `tenant_id`. Usar `@studio/tenant-context` para prefixos de storage.

2. **[2026-04-16] Composições não podem alterar estrutura do ambiente**
   Do instead: prompts de imagem devem preservar ângulo, perspectiva, enquadramento, janelas, portas, layout e arquitetura; alterar apenas cor de parede, piso, teto, revestimentos, móveis/decor solicitados.

3. **[2026-04-16] Pintura de parede deve ser edição localizada determinística**
   Do instead: para tinta/cor de parede/piso/teto, usar `SEGMENTATION_PROVIDER=grounded_sam` para máscara por texto + SAM, com fallback local SegFormer; recolorir/renderizar pixels da foto original dentro da máscara preservando luminância/sombra/textura. Não chamar modelo gerador para pintura localizada.

4. **[2026-04-17] Composições localizadas precisam de acabamento fotográfico**
   Do instead: após renderizar a superfície, aplicar integração de luz ambiente, sombras suaves, textura do material, correção leve de contraste/saturação e borda sem halo; o objetivo é parecer pintura/revestimento real, não overlay translúcido.

5. **[2026-04-17] Pedido genérico de parede significa todas as paredes visíveis**
   Do instead: quando o cliente pedir “parede” sem lado específico, aplicar em parede do fundo e paredes laterais visíveis. Só restringir a uma parede quando o prompt disser direita, esquerda, fundo ou outra posição específica.

6. **[2026-04-16] Composições devem preservar proporção e dimensões da imagem base**
   Do instead: calcular `aspect_ratio` pela foto original, evitar `1024x1024` fixo e instruir o modelo a preencher 100% do quadro; se normalizar localmente, usar `cover` no resultado gerado, nunca `fill`/stretch e nunca compor quadrado sobre a foto original.

7. **[2026-04-16] UAZAPI local entra por sync quando webhook não alcança localhost**
   Do instead: em dev local, disparar automações de inbox também em `/inbox/sync` somente para mensagens inbound recém-criadas, evitando depender do webhook externo direto.

8. **[2026-04-16] Chave OpenRouter vive no provider de IA, não no `.env`**
   Do instead: cadastrar API key e Base URL em Superadmin > IA & Modelos > Providers. O `.env` só pode conter opções não secretas de geração (`OPENROUTER_IMAGE_MODEL`, `OPENROUTER_IMAGE_SIZE`, `OPENROUTER_IMAGE_QUALITY`, `OPENROUTER_IMAGE_OUTPUT_FORMAT`); sem provider/credito real, jobs devem falhar explicitamente.

9. **[2026-04-05] Contratos TS são fonte de verdade para tipos do domínio**
   Do instead: alterar tipos em `packages/contracts/src/index.ts` e propagar para consumers.

10. **[2026-04-05] Fluxo: canal → gateway → API → orchestrator → composition**
   Do instead: respeitar essa cadeia ao adicionar funcionalidades. Cada serviço tem responsabilidade única.

## User Directives
1. **[2026-04-05] Sempre responder em Português**
   Do instead: todas as respostas devem ser em português brasileiro.
