# Plataforma Conversacional de Composição Visual

Este contexto define a linguagem de domínio da plataforma multi-tenant que cria composições visuais para clientes finais a partir de conversas e do estúdio do tenant.

## Language

**Tenant**:
Empresa que usa a plataforma para atender clientes finais e gerar composições visuais com sua própria identidade.
_Avoid_: conta, cliente, empresa cliente

**Cliente Final**:
Pessoa atendida pelo Tenant por um canal conversacional.
_Avoid_: cliente, usuário final, contato

**Composição Visual**:
Imagem final gerada para demonstrar uma alteração, aplicação de produto ou simulação visual solicitada.
_Avoid_: render, imagem gerada, arte

**Direção de Composição**:
Instrução do Cliente Final que define o que deve ser alterado, aplicado ou preservado em uma Composição Visual.
_Avoid_: comando, prompt, pedido genérico

**Pedido de Simulação Vago**:
Mensagem que demonstra intenção de criar ou continuar uma Composição Visual sem indicar a alteração desejada.
_Avoid_: pedido de composição, direção de composição

**Imagem de Ambiente**:
Imagem base do espaço que será modificado em uma Composição Visual.
_Avoid_: foto base, imagem original

**Imagem de Referência**:
Imagem usada como inspiração, produto ou direção visual para modificar uma Imagem de Ambiente.
_Avoid_: imagem exemplo, referência visual solta

**Continuação de Composição**:
Novo pedido feito após uma Composição Visual já existir na conversa.
_Avoid_: refazer, gerar outra, nova simulação

**Logo do Tenant**:
Imagem de marca configurada pelo Tenant para representar sua identidade visual.
_Avoid_: logomarca, marca, imagem da empresa

**Marca d'água**:
Aplicação semi-transparente da identidade do Tenant sobre uma Composição Visual.
_Avoid_: assinatura, overlay, carimbo

**Instância WhatsApp**:
Conexão de um número WhatsApp do Tenant usada para receber e enviar mensagens com Clientes Finais.
_Avoid_: número, conexão, sessão

**Conversa do Inbox**:
Histórico conversacional entre um Cliente Final e o Tenant dentro de uma Instância WhatsApp específica.
_Avoid_: chat, atendimento, thread

**Atendimento Operacional**:
Responsabilidade atual por responder uma Conversa do Inbox, atribuída à IA ou a um operador humano.
_Avoid_: assumir conversa, dono da conversa

**Gatilho de IA**:
Mensagem do Cliente Final que autoriza a IA a assumir o Atendimento Operacional de uma Conversa do Inbox.
_Avoid_: comando, palavra mágica, automação

**Histórico Preservado**:
Conversa do Inbox mantida visível após a remoção da Instância WhatsApp à qual pertence.
_Avoid_: conversa apagada, conversa órfã

**Vinculação de Conversa**:
Ação explícita que associa um Histórico Preservado a uma Instância WhatsApp ativa para permitir continuidade operacional.
_Avoid_: assumir conversa, migração automática

## Relationships

- Um **Tenant** pode configurar no máximo uma **Logo do Tenant** ativa.
- Uma **Composição Visual** pertence a exatamente um **Tenant**.
- Uma **Composição Visual** exige uma **Direção de Composição** antes de ser criada.
- Um **Pedido de Simulação Vago** deve gerar pergunta de clarificação, não uma **Composição Visual**.
- Quando múltiplas imagens chegam sem papel claro, o sistema deve perguntar qual é a **Imagem de Ambiente** e qual é a **Imagem de Referência**.
- Uma **Continuação de Composição** vaga deve perguntar se a base é a **Imagem de Ambiente** original ou a última **Composição Visual**.
- Uma **Marca d'água** usa preferencialmente a **Logo do Tenant**; na ausência dela, pode usar texto de identificação do Tenant.
- Uma **Marca d'água** é aplicada às **Composições Visuais** geradas no contexto do **Tenant**.
- Um **Tenant** pode ter várias **Instâncias WhatsApp**.
- Uma **Conversa do Inbox** pertence a exatamente uma **Instância WhatsApp** por vez.
- Um **Histórico Preservado** continua pertencendo ao **Tenant** mesmo quando sua **Instância WhatsApp** original foi removida.
- A **Vinculação de Conversa** exige uma ação explícita do operador dentro da **Conversa do Inbox** e uma **Instância WhatsApp** ativa do mesmo **Tenant**.
- A **Vinculação de Conversa** preserva a mesma **Conversa do Inbox** e todo o seu histórico.
- A **Vinculação de Conversa** não altera a origem histórica das mensagens antigas.
- A **Vinculação de Conversa** mantém o **Atendimento Operacional** com operador humano, salvo quando um **Gatilho de IA** for acionado.
- A **Vinculação de Conversa** não redefine as regras de **Gatilho de IA**.
- O **Atendimento Operacional** não altera, por si só, a **Instância WhatsApp** de uma **Conversa do Inbox**.

## Example dialogue

> **Dev:** "Se o **Tenant** gerar uma **Composição Visual** pelo WhatsApp ou pelo estúdio, a **Marca d'água** muda?"
> **Domain expert:** "Não. A regra é do **Tenant**: quando estiver ativada, a **Marca d'água** deve aparecer na **Composição Visual** independentemente da origem."

> **Dev:** "Quando a **Instância WhatsApp** é removida, a **Conversa do Inbox** some?"
> **Domain expert:** "Não. Ela vira **Histórico Preservado**. Para voltar a enviar por qualquer instância ativa do Tenant, o operador precisa fazer uma **Vinculação de Conversa** explícita dentro da conversa."

> **Dev:** "Se o **Cliente Final** disser 'quero simular outra imagem', já criamos a **Composição Visual**?"
> **Domain expert:** "Não. Isso é um **Pedido de Simulação Vago**; primeiro precisamos perguntar qual é a **Direção de Composição**."

## Flagged ambiguities

- "cliente" pode significar **Tenant** ou **Cliente Final** — resolvido: usar **Tenant** para a empresa que contrata a plataforma e **Cliente Final** para a pessoa atendida.
- "logo" foi padronizado como **Logo do Tenant** quando se refere à identidade visual configurada pelo Tenant.
- "assumir conversa" pode significar **Atendimento Operacional** ou **Vinculação de Conversa** — resolvido: usar **Atendimento Operacional** para responsabilidade humana/IA e **Vinculação de Conversa** para trocar a Instância WhatsApp usada pela conversa.
