export type ComoFicaTriggerMatch = {
  isOnlyTrigger: boolean
}

function normalizeTriggerText(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toLowerCase()
}

export function getComoFicaTriggerMatch(text: string): ComoFicaTriggerMatch | null {
  const normalized = normalizeTriggerText(text)
  const compact = normalized.replace(/[^a-z0-9]+/g, "")

  if (compact !== "comofica") {
    return null
  }

  return { isOnlyTrigger: true }
}

export function isComoFicaTriggerMessage(text: string | null | undefined) {
  return Boolean(getComoFicaTriggerMatch(text ?? ""))
}
