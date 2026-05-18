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

**Logo do Tenant**:
Imagem de marca configurada pelo Tenant para representar sua identidade visual.
_Avoid_: logomarca, marca, imagem da empresa

**Marca d'água**:
Aplicação semi-transparente da identidade do Tenant sobre uma Composição Visual.
_Avoid_: assinatura, overlay, carimbo

## Relationships

- Um **Tenant** pode configurar no máximo uma **Logo do Tenant** ativa.
- Uma **Composição Visual** pertence a exatamente um **Tenant**.
- Uma **Marca d'água** usa preferencialmente a **Logo do Tenant**; na ausência dela, pode usar texto de identificação do Tenant.
- Uma **Marca d'água** é aplicada às **Composições Visuais** geradas no contexto do **Tenant**.

## Example dialogue

> **Dev:** "Se o **Tenant** gerar uma **Composição Visual** pelo WhatsApp ou pelo estúdio, a **Marca d'água** muda?"
> **Domain expert:** "Não. A regra é do **Tenant**: quando estiver ativada, a **Marca d'água** deve aparecer na **Composição Visual** independentemente da origem."

## Flagged ambiguities

- "cliente" pode significar **Tenant** ou **Cliente Final** — resolvido: usar **Tenant** para a empresa que contrata a plataforma e **Cliente Final** para a pessoa atendida.
- "logo" foi padronizado como **Logo do Tenant** quando se refere à identidade visual configurada pelo Tenant.
