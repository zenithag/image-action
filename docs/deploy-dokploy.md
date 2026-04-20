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
- `DEV_LOGIN_EMAIL` e `DEV_LOGIN_PASSWORD`: acesso superadmin inicial.
- `DEV_TENANT_LOGIN_EMAIL` e `DEV_TENANT_LOGIN_PASSWORD`: acesso do tenant inicial.
- `OPENROUTER_API_KEY`: opcional se voce preferir cadastrar o provider pela tela de superadmin, mas recomendado para o primeiro deploy.

## Persistencia

O deploy usa volumes nomeados:

- `web_data`: produtos, providers, inbox, instancias WhatsApp, perfis de IA e jobs.
- `web_generated`: imagens geradas pelas composicoes.
- `segmentation_cache`: cache local dos modelos de segmentacao.

Sem esses volumes, os cadastros e imagens geradas podem sumir a cada redeploy.

## Observacoes

- O compose atual sobe somente `web` e `segmentation-service`, porque o fluxo ativo de catalogo, inbox, WhatsApp e composicoes roda pelas rotas do Next.js.
- O primeiro processamento de segmentacao pode demorar porque os modelos sao baixados para o cache do container.
- No Dokploy, variaveis da aba Environment sao escritas no `.env` do deploy e precisam estar referenciadas no compose. Este arquivo ja referencia as variaveis necessarias.
