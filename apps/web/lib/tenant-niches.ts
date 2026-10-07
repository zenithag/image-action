export type TenantNiche = { code: string; label: string }
export const defaultTenantNiches: TenantNiche[] = [
  { code: "generic", label: "Genérico" }, { code: "decor", label: "Decoração" },
  { code: "fashion", label: "Moda" }, { code: "automotive", label: "Automotivo" },
  { code: "furniture", label: "Móveis" }, { code: "real-estate", label: "Imóveis" },
  { code: "construction", label: "Construção" },
]
