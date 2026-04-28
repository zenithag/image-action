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

5. **[2026-04-26] Mídia gerada local não pode ir para UAZAPI como URL localhost**
   Do instead: para `/generated/...`, ler o arquivo do `public`, otimizar para JPEG menor e enviar via `/send/media` com `file` base64 e `text` caption; `localhost` só deve ficar para preview interno, nunca como fonte remota da UAZAPI.

6. **[2026-04-28] UAZAPI diferencia telefone de JID**
   Do instead: normalizar apenas telefones e JIDs `@s.whatsapp.net`/`@c.us` para dígitos; preservar destinatários `@lid` e `@g.us` completos para não quebrar envio.

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

5. **[2026-04-16] Composições devem preservar proporção e dimensões da imagem base**
   Do instead: calcular `aspect_ratio` pela foto original, evitar `1024x1024` fixo e instruir o modelo a preencher 100% do quadro; se normalizar localmente, usar `cover` no resultado gerado, nunca `fill`/stretch e nunca compor quadrado sobre a foto original.

6. **[2026-04-26] Continuação de composição usa memória de artefatos**
   Do instead: tratar imagens enviadas, composições geradas e SKUs/produtos como conhecimento consultável; não prender o cliente em etapas fixas. Depois de uma composição pronta, pedidos como “adicionar mais” usam a imagem gerada; original só quando o cliente pedir. Se uma nova imagem inbound chegou depois do último resultado, ela vira a base padrão.

7. **[2026-04-28] WhatsApp novo começa em atendimento humano**
   Do instead: conversas recebidas após cadastro/conexão da instância entram com `handledBy: "operator"`; a IA só envia quando o operador devolver a conversa para IA ou quando o cliente iniciar com o gatilho `Como Fica`/`comofica` no começo da mensagem.

8. **[2026-04-25] Referências do catálogo só vão quando o cliente pede; referência visual pode vir do cliente**
   Do instead: no WhatsApp, enviar imagens/cards de produtos apenas em pedido explícito de catálogo/referências/mais opções ou quando a ação for `show_catalog_options`; para composição aceitar SKU/produto do catálogo ou imagem de referência enviada pelo cliente, sempre com imagem base e direção clara de aplicação.

9. **[2026-04-26] Conversa da IA não pode ficar travada em pergunta antiga**
   Do instead: mensagens claras como SKU, catálogo, imagem ou edição seguem direto, ignorando pendências antigas; `original/nova` é inferência interna, não resposta obrigatória. Se a mensagem atual trouxer SKU/produto sem direção de montagem, perguntar o que fazer em vez de reaproveitar direção antiga.

10. **[2026-04-16] Chave OpenRouter vive no provider de IA, não no `.env`**
   Do instead: cadastrar API key e Base URL em Superadmin > IA & Modelos > Providers. O modelo de criação de imagem fica no perfil `Criacao de imagem`, padrão `google/gemini-3-pro-image-preview`. O `.env` só pode conter opções não secretas de geração (`OPENROUTER_IMAGE_SIZE`, `OPENROUTER_IMAGE_QUALITY`, `OPENROUTER_IMAGE_OUTPUT_FORMAT`); sem provider/credito real, jobs devem falhar explicitamente.

## User Directives
1. **[2026-04-05] Sempre responder em Português**
   Do instead: todas as respostas devem ser em português brasileiro.
