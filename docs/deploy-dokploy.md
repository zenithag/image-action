# Deploy no Dokploy

Este projeto deve ser publicado como uma aplicacao Docker Compose no Dokploy usando o arquivo `docker-compose.dokploy.yml`.

## Fluxo recomendado

1. No Dokploy, crie uma aplicacao do tipo Docker Compose.
2. Aponte o repositório para `git@github.com:zenithag/image-action.git` e branch `develop`.
3. Configure o compose file como `docker-compose.dokploy.yml`.
4. Copie as variaveis de `.env.dokploy.example` para a aba Environment do Dokploy e troque senhas, dominio e chaves.
5. Na aba Domains, adicione o dominio publico apontando para o servico `web` na porta `3000`.
6. Faça o deploy e acompanhe os logs do servico `web`.

## Variaveis obrigatorias

- `APP_URL`: URL publica final da aplicacao, por exemplo `https://app.seudominio.com`.
- `NEXTAUTH_SECRET`: segredo longo e aleatorio para sessoes.
- `DATABASE_URL`: conexao interna com o PostgreSQL do Dokploy. Se a senha tiver caracteres especiais, codifique a URL, por exemplo `@` como `%40`.
- `AUTH_BOOTSTRAP_SUPERADMIN_EMAIL` e `AUTH_BOOTSTRAP_SUPERADMIN_PASSWORD`: acesso superadmin inicial.
- `AUTH_BOOTSTRAP_TENANT_EMAIL` e `AUTH_BOOTSTRAP_TENANT_PASSWORD`: acesso do tenant inicial.
- `OPENROUTER_API_KEY`: opcional se voce preferir cadastrar o provider pela tela de superadmin, mas recomendado para o primeiro deploy.

## Persistencia

Os dados estruturados da aplicacao ficam no PostgreSQL configurado em `DATABASE_URL`, na tabela `app_documents`. Isso inclui usuarios, produtos, providers, inbox, instancias WhatsApp, perfis de IA e jobs de composicao.

O deploy ainda usa volumes nomeados para arquivos binarios e cache:

- `web_data`: fallback local e cache de midias do WhatsApp.
- `web_generated`: imagens geradas pelas composicoes.
- `segmentation_cache`: cache local dos modelos de segmentacao.

Sem o `DATABASE_URL`, o app cai para persistencia local em `web_data`, que deve ser usado apenas em desenvolvimento ou emergencia. Sem os volumes, imagens geradas e midias em cache podem sumir a cada redeploy.

As variaveis `AUTH_BOOTSTRAP_*` criam usuarios apenas quando o e-mail ainda nao existe; elas nao sobrescrevem senhas ja persistidas no PostgreSQL.

Para criar ou garantir um superadmin por seed, execute no ambiente com `DATABASE_URL` configurado:

```bash
pnpm seed:superadmin
```

No container de producao do Dokploy, use:

```bash
docker exec <container-web> node apps/web/scripts/seed-superadmin.mjs
```

O seed usa `SEED_SUPERADMIN_*` e, se essas variaveis nao existirem, usa `AUTH_BOOTSTRAP_SUPERADMIN_*`. Por padrao ele e idempotente: se o e-mail ja existir, apenas garante `role=superadmin`, `status=active` e remove vinculo de tenant. Para trocar a senha de um usuario existente via seed, use `SEED_SUPERADMIN_OVERWRITE=true`.

## Observacoes

- O compose atual sobe `web`, `app-job-worker` e `segmentation-service`. O `app-job-worker` usa a mesma imagem do web, mas roda em porta interna e drena a fila de jobs sem expor rota publica.
- O primeiro processamento de segmentacao pode demorar porque os modelos sao baixados para o cache do container.
- No Dokploy, variaveis da aba Environment sao escritas no `.env` do deploy e precisam estar referenciadas no compose. Este arquivo ja referencia as variaveis necessarias.
