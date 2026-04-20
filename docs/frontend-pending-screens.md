# Inventario de rotas e telas pendentes do front-end

Data do levantamento: 2026-04-14

Este documento lista rotas, telas e acoes visuais que aparecem no front-end, mas ainda nao possuem tela, detalhe, persistencia ou comportamento implementado. Nao inclui alteracoes de codigo, apenas inventario.

## Rotas existentes

### Autenticacao

- `/`
- `/login`
- `/auth/signin`
- `/auth/post-login`
- `/api/auth/[...nextauth]`

### Superadmin

- `/superadmin`

### Tenant

- `/tenant/[slug]`
- `/tenant/[slug]/analytics`
- `/tenant/[slug]/catalog`
- `/tenant/[slug]/compositions`
- `/tenant/[slug]/contacts`
- `/tenant/[slug]/inbox`
- `/tenant/[slug]/settings`
- `/tenant/[slug]/whatsapp`

## Rotas referenciadas, mas sem tela

Estas rotas aparecem na navegacao ou fazem sentido a partir da UI atual, mas nao existem em `apps/web/app`.

### Superadmin

- `/superadmin/domains`
- `/superadmin/usage`
- `/superadmin/channels`
- `/superadmin/tenants/[id]`

### Tenant

- `/tenant/[slug]/catalog/[id]`
- `/tenant/[slug]/compositions/[id]`
- `/tenant/[slug]/contacts/[id]`
- `/tenant/[slug]/inbox/[id]`

## Telas existentes com dados mockados ou estaticos

### Dashboard do tenant

- Rota: `/tenant/[slug]`
- Arquivo: `apps/web/app/tenant/[slug]/page.tsx`
- Status: a tela existe, mas os cards, graficos e metricas usam dados estaticos.
- Pendente: visualizacao de detalhe dos cards de Conversas, Composicoes, Novos Contatos e Taxa de Conversao.
- Pendente: filtro de periodo no select existe visualmente, mas nao altera os dados.

### Analytics

- Rota: `/tenant/[slug]/analytics`
- Arquivo: `apps/web/app/tenant/[slug]/analytics/page.tsx`
- Status: tela existe, mas usa dados estaticos.
- Pendente: filtros de periodo e drill-down dos graficos.
- Observacao: a rota raiz do tenant e `/analytics` parecem duplicar muito do mesmo dashboard.

### Superadmin

- Rota: `/superadmin`
- Arquivo: `apps/web/app/superadmin/page.tsx`
- Status: lista tenants via API, mas nao possui paginas ou detalhes de operacao.
- Pendente: detalhe do tenant.
- Pendente: telas de Dominios, Uso & Custos e Canais.
- Pendente: acoes de gestao global, como criar tenant, editar tenant, ver dominios e conferir sessoes desconectadas.

### Catalogo

- Rota: `/tenant/[slug]/catalog`
- Arquivo: `apps/web/components/catalog-browser.tsx`
- Status: tela existe com mock local de produtos.
- Pendente: criar novo item.
- Pendente: filtros avancados.
- Pendente: menu de acoes por item.
- Pendente: visualizacao de detalhes do item.
- Pendente: rota de detalhe do item.

### Composicoes

- Rota: `/tenant/[slug]/compositions`
- Arquivo: `apps/web/components/composition-jobs.tsx`
- Status: tela existe com mock local de jobs.
- Pendente: atualizar lista a partir da API.
- Pendente: visualizar resultado em detalhe.
- Pendente: abrir preview/modal da imagem resultante.
- Pendente: tentar novamente job com falha.
- Pendente: rota de detalhe da composicao/job.

### Contatos

- Rota: `/tenant/[slug]/contacts`
- Arquivo: `apps/web/app/tenant/[slug]/contacts/page.tsx`
- Status: tela existe com mock local.
- Pendente: importar contatos.
- Pendente: busca funcional.
- Pendente: menu de acoes por contato.
- Pendente: detalhe do contato.
- Pendente: rota de detalhe do contato.

### Inbox

- Rota: `/tenant/[slug]/inbox`
- Arquivos:
- `apps/web/components/conversation-list.tsx`
- `apps/web/components/chat-panel.tsx`
- Status: tela existe com mock local de conversas e mensagens.
- Pendente: filtros IA e Operador.
- Pendente: assumir conversa.
- Pendente: menu de acoes da conversa.
- Pendente: anexar arquivo.
- Pendente: anexar imagem.
- Pendente: envio real de mensagem.
- Pendente: detalhe/rota por conversa.

### Settings

- Rota: `/tenant/[slug]/settings`
- Arquivo: `apps/web/app/tenant/[slug]/settings/page.tsx`
- Status: tela existe, mas os formularios e botoes nao persistem.
- Pendente: abas laterais mudarem o conteudo.
- Pendente: salvar alteracoes gerais.
- Pendente: adicionar dominio proprio.
- Pendente: alterar modelo do assistente IA.
- Pendente: carregar e persistir configuracoes por tenant.

### WhatsApp

- Rota: `/tenant/[slug]/whatsapp`
- Arquivo: `apps/web/components/whatsapp-connection.tsx`
- Status: fluxo existe, mas e simulado em estado local.
- Pendente: gerar QR Code real via API/provedor.
- Pendente: persistir nome da conexao.
- Pendente: ler status real da conexao.
- Pendente: desconectar aparelho via API/provedor.

## Componentes nao usados ou duplicados

### Componentes em `components/organisms`

- `apps/web/components/organisms/catalog-browser.tsx`
- `apps/web/components/organisms/conversation-list.tsx`
- `apps/web/components/organisms/chat-panel.tsx`
- `apps/web/components/organisms/tenant-sidebar.tsx`
- `apps/web/components/organisms/tenant-dashboard.tsx`
- `apps/web/components/organisms/superadmin-dashboard.tsx`
- `apps/web/components/organisms/platform-overview.tsx`

Observacao: estes componentes parecem representar uma camada anterior ou alternativa de UI. Alguns possuem chamadas reais de API, mas as rotas atuais do tenant usam os componentes em `apps/web/components/` sem o namespace `organisms`.

## Prioridade sugerida

1. Criar telas faltantes do superadmin: dominios, uso/custos e canais.
2. Definir se `/tenant/[slug]` e `/tenant/[slug]/analytics` devem ser telas distintas ou uma deve redirecionar para a outra.
3. Criar detalhe de catalogo, composicoes, contatos e conversas.
4. Conectar contatos, catalogo, inbox e composicoes com API real.
5. Implementar acoes visuais hoje inativas: criar/importar, visualizar, tentar novamente, salvar, filtros e menus.
6. Remover ou consolidar componentes duplicados em `components/organisms`.
