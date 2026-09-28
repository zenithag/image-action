import type { CompositionJobInput } from "./composition-types"
import type { StudioImageArtifact } from "./studio-draft"

export const MAX_REFERENCES = 5
export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024
export const MAX_REQUEST_BYTES = 9_500_000
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"]

export function validateStudioFiles(files: Pick<File, "type" | "size">[], currentCount: number, slot: "base" | "reference") {
  if (slot === "base" && files.length !== 1) return "Selecione apenas uma foto do ambiente."
  if (slot === "reference" && currentCount + files.length > MAX_REFERENCES) return "Você pode adicionar até 5 referências. Remova uma para continuar."
  if (files.some(file => !IMAGE_TYPES.includes(file.type))) return "Use imagens JPG, PNG ou WebP."
  if (files.some(file => file.size > MAX_UPLOAD_BYTES)) return "Cada imagem deve ter no máximo 15 MB."
  return null
}

export function buildStudioInput(slug: string, base: StudioImageArtifact, references: StudioImageArtifact[], instruction: string): CompositionJobInput {
  if (!base.mediaUrl || !instruction.trim()) throw new Error("Adicione um ambiente e descreva a transformação.")
  if (references.length > MAX_REFERENCES) throw new Error("Use no máximo 5 referências.")
  if (instruction.trim().length > 4000) throw new Error("A instrução deve ter até 4.000 caracteres.")
  return {
    studioVersion: "v1",
    conversationId: base.conversationId || `studio:${slug}`,
    channelInstanceId: base.channelInstanceId || "studio-upload",
    contactName: base.contactName || "Studio",
    contactPhone: base.contactPhone,
    source: "operator",
    mode: "interior",
    baseImageUrl: base.mediaUrl,
    baseMessageId: base.source === "inbox" ? base.messageId : undefined,
    references: references.map(ref => ({
      source: ref.source === "upload" ? "url" : ref.source,
      imageUrl: ref.source !== "catalog" ? ref.mediaUrl : undefined,
      messageId: ref.messageId,
      catalogItemId: ref.catalogItemId,
      catalogItemName: ref.catalogItemName,
      catalogSku: ref.catalogSku,
      catalogCategory: ref.catalogCategory,
      catalogDescription: ref.catalogDescription,
    })),
    prompt: [
      instruction.trim(),
      "Preserve a câmera, a perspectiva e a arquitetura do ambiente.",
      references.length ? "Aplique as referências em conjunto, na ordem enviada, seguindo a instrução." : "",
      ...references.map((ref, index) => ref.source === "catalog"
        ? `Referência ${index + 1}: ${ref.catalogItemName || "produto"}. SKU: ${ref.catalogSku || "não informado"}. ${ref.catalogDescription || ""}`.slice(0, 150)
        : `Referência ${index + 1}: ${ref.caption || "imagem enviada"}.`.slice(0, 150)),
    ].filter(Boolean).join("\n"),
  }
}
