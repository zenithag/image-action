# Flows

## Fluxo WhatsApp para composicao

1. cliente envia mensagem e midia no WhatsApp
2. UAZAPI/WUZAPI envia webhook ao `channel-gateway`
3. sistema identifica o tenant
4. mensagem e assets sao persistidos
5. `orchestrator` chama OpenRouter
6. LLM classifica a intencao e decide uma action:
   - responder pergunta simples
   - pedir referencia faltante
   - criar job `interior`
   - criar job `product`
   - escalar para humano
7. `composition` processa a solicitacao
8. resultado vai para `auto-send` ou `review-required`
9. resposta final e enviada ao canal

## Fluxo de onboarding de tenant

1. superadmin cria tenant manualmente
2. cadastra plano e limites iniciais
3. conecta sessao do WhatsApp
4. define dominio principal
5. configura LLM profile e prompts-base
6. publica tenant para operacao

## Fluxo de revisao humana

1. job entra com `review_required = true`
2. operador revisa o render
3. corrige prompt, mascara ou asset
4. reenfileira ou aprova
5. sistema envia a resposta final
