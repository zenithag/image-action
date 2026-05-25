# Correcoes do Inbox WhatsApp

Este planejamento consolida as modificacoes decididas na conversa de 2026-05-25. As entregas devem ser tratadas separadamente para reduzir risco.

## Entrega urgente: excluir conversa do inbox

Objetivo: permitir que o operador remova uma conversa da visualizacao do inbox sem apagar composicoes geradas.

Regras:

- Adicionar acao "Excluir conversa" na visualizacao da conversa.
- Adicionar atalho opcional de exclusao na lista de conversas.
- Exigir confirmacao antes de excluir.
- Excluir somente a conversa e suas mensagens do inbox.
- Nao excluir jobs, assets, resultados ou historico de composicoes.
- Depois de excluir, limpar a selecao da conversa na UI.

Validacao:

- Excluir uma conversa com composicoes associadas.
- Confirmar que ela sai do inbox.
- Confirmar que os jobs de composicao continuam no historico de composicoes.
- Rodar `pnpm typecheck:web`.

## Entrega 1: preservar e vincular historico de instancia removida

Objetivo: conversas e composicoes feitas por uma instancia removida continuam disponiveis, mas envio fica bloqueado ate vinculacao explicita.

Regras decididas:

- Conversas de instancia removida continuam visiveis como Historico Preservado.
- O envio fica bloqueado ate o operador fazer Vinculacao de Conversa dentro da conversa.
- A vinculacao pode usar qualquer Instancia WhatsApp ativa do mesmo Tenant, independente de ser o mesmo numero antigo.
- Se houver uma unica instancia ativa, vincular direto.
- Se houver mais de uma instancia ativa, exigir escolha do operador.
- Manter o mesmo `conversationId`; nao criar conversa nova nem migrar historico.
- Mensagens antigas mantem origem historica.
- Mensagens novas usam a instancia vinculada.
- Novas mensagens recebidas pela instancia vinculada devem entrar na mesma conversa antiga vinculada.
- Se ja existir conversa ativa para o mesmo Cliente Final naquela instancia, bloquear a vinculacao e apontar para a conversa existente.
- Apos vincular manualmente, Atendimento Operacional fica com operador.
- Gatilho de IA existente nao muda.

## Entrega 2: evitar composicao sem direcao clara

Objetivo: impedir que a IA crie Composicao Visual quando o Cliente Final ainda nao disse o que deve ser alterado.

Regras decididas:

- A IA nao deve criar Composicao Visual a partir de Pedido de Simulacao Vago.
- "Quero simular outra imagem", "simular de novo", "fazer outra" e respostas como "opcao 1" nao criam job sozinhas.
- Quando houver duas imagens sem papel claro, perguntar qual e Imagem de Ambiente e qual e Imagem de Referencia.
- Apos o Cliente Final escolher "opcao 1" ou "opcao 2", guardar a escolha e perguntar qual e a Direcao de Composicao.
- Quando ja existir composicao pronta e o pedido for vago, perguntar se a base deve ser a imagem original ou a ultima composicao, e o que deve ser alterado.
- A escolha de base fica guardada na Conversa do Inbox ate receber a direcao, reiniciar contexto, uma nova sequencia de imagens invalidar a escolha ou a regra existente de conversa antiga exigir retomada.

## Entrega 3: ajustes de configuracao do Tenant

Objetivo: tratar as observacoes de UX/admin separadamente da automacao de composicao.

Pontos levantados:

- Campo de palavras para chamar operador parece limitar uma palavra no uso real; validar se o problema e UI, input mobile ou normalizacao.
- Perfil de modelo e id do modelo ficam visiveis ao Tenant; avaliar ocultar ou simplificar para nao expor fornecedor/modelo.
- Prompt do sistema fica editavel/visivel; decidir se Tenant deve ver isso ou se deve ser configuracao interna.
- Notificacoes por email/WhatsApp e resumo diario precisam indicar claramente se estao funcionais ou apenas configurados.
- Cupom e indicacoes existem na tela; validar comportamento real e textos.
