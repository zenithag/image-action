const baseUrl = process.env.AI_REGRESSION_BASE_URL || "http://localhost:3000"
const tenantSlug = process.env.AI_REGRESSION_TENANT || "decor-labs"

const cases = [
  {
    name: "saudacao curta",
    payload: {
      text: "oi",
      mediaTypes: [],
      conversationState: "idle",
      recentMessages: [],
    },
    assert(result) {
      return result.next_action === "reply_in_chat"
    },
  },
  {
    name: "pedido humano explicito",
    payload: {
      text: "quero falar com um atendente humano",
      mediaTypes: [],
      conversationState: "idle",
      recentMessages: [],
    },
    assert(result) {
      return result.next_action === "handoff_to_operator"
    },
  },
  {
    name: "imagem sem instrucao",
    payload: {
      text: "",
      mediaTypes: ["image"],
      conversationState: "idle",
      recentMessages: [],
    },
    assert(result) {
      return result.next_action === "ask_for_reference_image"
    },
  },
  {
    name: "catalogo sem imagem base",
    payload: {
      text: "quero usar essa tinta azul na parede",
      mediaTypes: [],
      conversationState: "idle",
      catalogContext: "1. Tinta Azul Oceano (#0055AA) - tinta premium para parede interna",
      hasBaseImage: false,
      recentMessages: [],
    },
    assert(result) {
      return result.next_action === "show_catalog_options"
    },
  },
  {
    name: "catalogo com imagem base",
    payload: {
      text: "aplica essa tinta azul na parede",
      mediaTypes: [],
      conversationState: "collecting_preferences",
      catalogContext: "1. Tinta Azul Oceano (#0055AA) - tinta premium para parede interna",
      hasBaseImage: true,
      recentMessages: [],
    },
    assert(result) {
      return result.next_action === "create_composition_job"
    },
  },
]

async function requestJson(url, init) {
  const response = await fetch(url, init)
  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(payload)}`)
  }

  return payload
}

async function main() {
  const results = []

  for (const testCase of cases) {
    const result = await requestJson(`${baseUrl}/api/tenant/${tenantSlug}/ai/classify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(testCase.payload),
    })

    const passed = testCase.assert(result)
    results.push({ name: testCase.name, passed, action: result.next_action, rationale: result.rationale })
  }

  const failed = results.filter((item) => !item.passed)

  for (const result of results) {
    console.log(`${result.passed ? "PASS" : "FAIL"} | ${result.name} | action=${result.action}`)
  }

  if (failed.length > 0) {
    console.error(`\n${failed.length} caso(s) falharam na regressao de IA.`)
    process.exit(1)
  }

  console.log("\nRegressao de IA concluida sem falhas.")
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
})
