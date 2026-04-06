import type { ClassificationResponse, Conversation, Message, Tenant } from "@studio/contracts"

import { TenantDashboard } from "@/components/organisms/tenant-dashboard"

const tenant: Tenant = {
  id: "tenant-1",
  name: "Decor Labs",
  slug: "decor-labs",
  status: "active",
  plan_code: "growth",
}

const conversation: Conversation = {
  id: "conv-12345678",
  tenant_id: "tenant-1",
  channel_id: "channel-1",
  contact_id: "contact-1",
  status: "open",
}

const latestMessage: Message = {
  id: "msg-1",
  tenant_id: "tenant-1",
  conversation_id: "conv-12345678",
  direction: "inbound",
  role: "customer",
  content: "Quero ver essa tinta terracota aplicada na parede da minha sala.",
  provider_message_id: "provider-1",
}

const classification: ClassificationResponse = {
  intent: "visual_edit",
  mode: "interior",
  next_action: "ask_for_reference_image",
  confidence: 0.82,
  needs_human_review: false,
  missing_inputs: ["reference_image"],
  rationale: "A mensagem indica pedido visual de interiores, mas ainda falta a referencia de cor ou textura.",
  source: "heuristic",
}

export default async function TenantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8 md:py-10">
        <TenantDashboard tenant={{ ...tenant, slug }} conversation={conversation} latestMessage={latestMessage} classification={classification} />
      </div>
    </main>
  )
}
