# Auditoria da Interface - 2026-04-23

Metodologia:
- leitura das rotas reais em `apps/web/app`
- leitura dos componentes usados por cada view
- verificação HTTP local em `localhost:3000`
- inspeção das APIs consumidas por cada tela

Observação:
- a navegação automatizada com Playwright MCP não pôde ser concluída neste ambiente por limitação de filesystem do runtime (`/.playwright-mcp` somente leitura)
- a classificação abaixo foi feita por evidência de código e respostas HTTP/APIs

Legenda:
- `Funcional`: a tela consome API real e as ações principais estão implementadas
- `Parcial`: a tela abre e parte do fluxo funciona, mas há blocos estáticos, métricas falsas ou ações sem efeito
- `Mock/Protótipo`: a tela ainda é basicamente estática ou usa dados hardcoded

## Público e autenticação

| Rota | Status | O que funciona | O que não funciona / limitação |
| --- | --- | --- | --- |
| `/` | Funcional | exibe login real via `next-auth` credentials, trata erro de login e redireciona por sessão/callback | depende de usuário previamente seedado |
| `/login` | Funcional | redireciona para `/` | não é uma tela própria |
| `/auth/signin` | Funcional | redireciona para `/` | não é uma tela própria |
| `/auth/post-login` | Funcional | redireciona para dashboard correto conforme sessão | sem UI própria |

## Super Admin

| Rota | Status | O que funciona | O que não funciona / limitação |
| --- | --- | --- | --- |
| `/superadmin` | Parcial | listagem real de tenants, busca, criação, exclusão e navegação para detalhe | cards de topo ainda têm métricas placeholder como `Instâncias WhatsApp` e `MRR` com `—` |
| `/superadmin/tenants/[id]` | Funcional | edição real do tenant, alteração de plano/status/nicho, remoção do tenant, edição das configurações de segmentação | escopo ainda restrito a cadastro + segmentação; não centraliza toda a operação do tenant |
| `/superadmin/usage` | Parcial | carrega tenants reais e agrega estatísticas reais básicas | custo infra é fake (`R$ 0,00`), gráfico semanal é derivado artificialmente dos totais, seção de uso ainda mostra placeholders como "Ainda nao ha uso real registrado" e "Últimas conversas" sem dados reais |
| `/superadmin/domains` | Mock/Protótipo | busca local na tabela renderizada | usa `MOCK_DOMAINS`, não consome API, botão "Atribuir domínio" e ação "Ver DNS" não têm integração real |
| `/superadmin/channels` | Parcial | CRUD real de providers globais, teste de conexão real, exclusão real, cadastro com admin token do UAZAPI | aba "Instâncias dos tenants" não usa dados reais (`tenantInstances` é array vazio hardcoded), botão "Editar" no card do provider não tem handler, aba de planos é estática |
| `/superadmin/ai` | Parcial | CRUD real de provider OpenRouter, teste real, exclusão real, sincronização real de modelos, perfis de IA editáveis e persistidos | seção "Modelos de composição" é hardcoded, guardrails são só visuais e não persistem nem configuram backend |

## Tenant

| Rota | Status | O que funciona | O que não funciona / limitação |
| --- | --- | --- | --- |
| `/tenant/[slug]` | Parcial | dashboard usa analytics real do tenant | herda as mesmas limitações da view de analytics: custos fake, blocos editoriais e placeholders |
| `/tenant/[slug]/analytics` | Parcial | consome `/api/tenant/[slug]/analytics`, mostra totais reais agregados | seletor de período não altera a consulta, custo do mês é fixo em `R$ 0,00`, fila de revisão e últimas conversas ainda são placeholders |
| `/tenant/[slug]/catalog` | Funcional | listagem real, filtro por busca/categoria/status/tags, criação, edição, exclusão e bulk actions reais | botão `Importar` está desabilitado; sem fluxo real de importação em massa |
| `/tenant/[slug]/contacts` | Parcial | listagem real, criação, edição e exclusão de contatos manuais, exibe contatos do inbox | botão `Importar CSV` é só visual; contatos vindos do inbox não podem ser geridos integralmente pela própria tela |
| `/tenant/[slug]/inbox` | Parcial | lista real de conversas, sync/polling real, marcar lida, carregar mensagens reais, takeover para operador, devolver para IA, enviar mensagem manual, render de imagem/áudio/vídeo/documento | painel lateral direito é totalmente estático, ações rápidas são mock, botões de anexar arquivo/imagem estão desabilitados, menu `MoreVertical` não faz nada |
| `/tenant/[slug]/whatsapp` | Parcial | criação real de instância, geração de QR, refresh de status, seleção de instância e exclusão real | card conectado mostra métricas placeholder (`Mensagens/h`, `Jobs hoje`), botão "Desconectar" só reseta o estado local e não chama backend para desconectar a instância |
| `/tenant/[slug]/compositions` | Parcial | listagem real de jobs, filtros por status, processar fila, processar job, reenfileirar, abrir modal, download do resultado e do comparativo | botão "Aprovar e enviar" está desabilitado, barra de progresso/confiança é artificial (20/50/95), modal ainda expõe elementos de fachada |
| `/tenant/[slug]/editor` | Mock/Protótipo | layout e controles visuais do estúdio | tela é praticamente estática; não há pipeline real ligado aos controles, dropzones, ferramentas ou geração |
| `/tenant/[slug]/settings` | Parcial | carrega e salva configurações persistidas do tenant | várias seções são preferências administrativas ainda sem efeito operacional pleno; não substitui integrações reais de domínio, billing, equipe ou canais |

## Observações transversais

1. As rotas de tenant estão protegidas por sessão e slug no middleware, e as de superadmin exigem role de superadmin.
2. O sidebar e o badge de não lidas do inbox usam API real.
3. O realtime por WebSocket é opcional; a interface principal hoje depende mais de polling do que de socket.
4. Há divergência entre "tela funcional" e "fluxo operacional completo": várias views persistem dados, mas ainda exibem blocos estáticos ou ações de fachada.

## Prioridade de correção

1. Remover ou completar telas 100% mockadas:
   - `/superadmin/domains`
   - `/tenant/[slug]/editor`

2. Fechar lacunas de telas parcialmente operacionais:
   - `/superadmin/channels` (editar provider + instâncias reais)
   - `/superadmin/ai` (guardrails e modelos sem hardcode)
   - `/tenant/[slug]/whatsapp` (desconectar real + métricas reais)
   - `/tenant/[slug]/compositions` (aprovar/enviar real)
   - `/tenant/[slug]/inbox` (contexto lateral e anexos de saída)

3. Corrigir dashboards editoriais para dados reais:
   - `/superadmin/usage`
   - `/tenant/[slug]/analytics`
   - `/tenant/[slug]`
