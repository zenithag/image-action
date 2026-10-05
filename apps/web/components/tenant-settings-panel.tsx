"use client"

import { Tabs } from "@/components/spectrum/tabs"
import { PageHeader } from "@/components/organisms/page-header"
import { BRAND } from "@/lib/brand-palette"
import { getReadableTextColor } from "@/lib/tenant-branding"
import { ToggleButton } from "@/components/spectrum/toggle-button"
import { Input, NativeSelect, Textarea } from "@/components/spectrum/fields"
import { useEffect, useState, type ReactNode } from "react"
import { Copy, Gift, Loader2, Save, Upload } from "@/components/spectrum/icons"

import { SafeImage } from "@/components/safe-image"
import { Button } from "@/components/ui/button"
import type { AiModelProfile } from "@/lib/ai-types"
import type { CatalogItem } from "@/lib/catalog-types"
import type { TenantReferralProgram } from "@/lib/commercial-benefits-types"
import type { TenantSettings, TenantSettingsTeamMember, TenantSettingsTeamMemberRole } from "@/lib/tenant-settings-types"
import type { TenantTokenSnapshot } from "@/lib/token-ledger-types"
import { normalizeTenantBrandingSnapshot } from "@/lib/tenant-branding"
import { cn } from "@/lib/utils"

type TenantSettingsPanelProps = {
  tenantSlug: string
}

type SectionId = "branding" | "domain" | "assistant" | "limits" | "team" | "billing"

const sections: Array<{ id: SectionId; title: string }> = [
  { id: "branding", title: "Marca & dados" },
  { id: "domain", title: "Domínio" },
  { id: "assistant", title: "IA & prompts" },
  { id: "limits", title: "Limites" },
  { id: "team", title: "Time" },
  { id: "billing", title: "Faturamento" },
]

// Themes a tenant can pick. The first is what a new tenant gets when it subscribes.
// `secondary` is only used for the swatch: the brand theme pairs Dark Blue with Tifany.
const BRAND_PRESETS: { name: string; primary: string; secondary?: string }[] = [
  { name: "Como fica.ai (padrão)", primary: BRAND.tifany, secondary: BRAND.darkBlue },
  { name: "Verde clássico", primary: "#00AF67" },
  { name: "Grafite", primary: "#2b2f36" },
  { name: "Óleo índigo", primary: "#3b5bdb" },
  { name: "Terracota", primary: "#c0562a" },
  { name: "Uva", primary: "#7048e8" },
  { name: "Cobre", primary: "#b26b3c" },
  { name: "Oceano", primary: "#0b7285" },
  { name: "Rosa vivo", primary: "#e03e8a" },
]

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result)
        return
      }

      reject(new Error("Nao foi possivel preparar o logo."))
    }

    reader.onerror = () => reject(new Error("Nao foi possivel ler o logo."))
    reader.readAsDataURL(file)
  })
}

async function requestJson<T>(url: string, init?: RequestInit) {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  })
  const payload = await response.json().catch(() => null) as T | { error?: string } | null

  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload && typeof payload.error === "string"
      ? payload.error
      : "Requisicao invalida."
    throw new Error(message)
  }

  return payload as T
}

function asLines(values: string[]) {
  return values.join("\n")
}

function fromLines(value: string) {
  return value
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function formatSignedAmount(value: number) {
  return `${value > 0 ? "+" : ""}${value}`
}

function getCatalogCategories(items: CatalogItem[]) {
  const categoriesByKey = new Map<string, string>()

  for (const item of items) {
    const category = item.category.trim()
    if (!category) continue

    const key = normalizeCategoryOption(category)
    const existing = categoriesByKey.get(key)

    if (!existing || (existing === existing.toLowerCase() && category !== category.toLowerCase())) {
      categoriesByKey.set(key, category)
    }
  }

  return [...categoriesByKey.values()].sort((left, right) => left.localeCompare(right, "pt-BR"))
}

function normalizeCategoryOption(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim()
}

function keepExistingCatalogCategories(values: string[], categories: string[]) {
  const categoriesByKey = new Map(categories.map((category) => [normalizeCategoryOption(category), category] as const))
  const selected = values
    .map((value) => categoriesByKey.get(normalizeCategoryOption(value)))
    .filter((value): value is string => Boolean(value))

  return [...new Set(selected)]
}

function toggleListValue(values: string[], value: string) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value]
}

/**
 * One settings group, laid out like a block of the Analytics page: title and description above the
 * controls, full width, groups separated by a rule. No card behind it.
 */
function SettingsGroup({ title, description, children, className }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("py-8 first:pt-0 last:pb-2", className)}>
      <header className="mb-5 min-w-0">
        <h3 className="text-base font-bold text-foreground">{title}</h3>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </header>
      <div className="min-w-0">{children}</div>
    </section>
  )
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <label className={cn("space-y-2", className)}>
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Input
      {...props}
      className={cn(
        "h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none transition-colors focus:border-primary",
        props.className
      )}
    />
  )
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Textarea
      {...props}
      className={cn(
        "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-primary",
        props.className
      )}
    />
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between border-t border-border pt-4 text-left transition-colors hover:border-primary/50"
    >
      <span className="text-sm font-medium text-foreground">{label}</span>
      <span className={cn("relative h-6 w-11 rounded-full transition-colors", checked ? "bg-primary" : "bg-muted")}>
        <span className={cn("absolute top-1 h-4 w-4 rounded-full bg-white transition-transform", checked ? "translate-x-6" : "translate-x-1")} />
      </span>
    </button>
  )
}

export function TenantSettingsPanel({ tenantSlug }: TenantSettingsPanelProps) {
  const [activeSection, setActiveSection] = useState<SectionId>("branding")
  const [settings, setSettings] = useState<TenantSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [modelProfiles, setModelProfiles] = useState<AiModelProfile[]>([])
  const [tokenSnapshot, setTokenSnapshot] = useState<TenantTokenSnapshot | null>(null)
  const [referralProgram, setReferralProgram] = useState<TenantReferralProgram | null>(null)
  const [catalogCategories, setCatalogCategories] = useState<string[]>([])
  const [couponCode, setCouponCode] = useState("")
  const [isRedeemingCoupon, setIsRedeemingCoupon] = useState(false)

  function emitBrandingUpdate(nextSettings: TenantSettings) {
    if (typeof window === "undefined") {
      return
    }

    const snapshot = normalizeTenantBrandingSnapshot({
      companyName: nextSettings.general.companyName,
      primaryColor: nextSettings.branding.primaryColor,
      logoUrl: nextSettings.branding.logoUrl,
    })

    window.dispatchEvent(new CustomEvent("tenant-branding-updated", {
      detail: {
        tenantSlug,
        ...snapshot,
      },
    }))
  }

  async function applyLogoFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("Selecione um arquivo de imagem valido para o logo.")
      return
    }

    if (file.size > 2 * 1024 * 1024) {
      setError("O logo precisa ter no maximo 2 MB.")
      return
    }

    try {
      const dataUrl = await fileToDataUrl(file)
      updateSection("branding", { logoUrl: dataUrl })
      setError(null)
      setNotice("Logo pronto para salvar.")
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Nao foi possivel carregar o logo.")
    }
  }

  async function loadSettings() {
    setIsLoading(true)
    setError(null)

    try {
      const [settingsData, tokensData, referralData, catalogItems] = await Promise.all([
        requestJson<TenantSettings>(`/api/tenant/${tenantSlug}/settings`, { cache: "no-store" }),
        requestJson<TenantTokenSnapshot>(`/api/tenant/${tenantSlug}/billing/tokens`, { cache: "no-store" }),
        requestJson<TenantReferralProgram>(`/api/tenant/${tenantSlug}/billing/referrals`, { cache: "no-store" }),
        requestJson<CatalogItem[]>(`/api/tenant/${tenantSlug}/catalog/items`, { cache: "no-store" }),
      ])
      const categories = getCatalogCategories(catalogItems)
      setSettings({
        ...settingsData,
        assistant: {
          ...settingsData.assistant,
          catalogCategories: keepExistingCatalogCategories(settingsData.assistant.catalogCategories, categories),
        },
      })
      setTokenSnapshot(tokensData)
      setReferralProgram(referralData)
      setCatalogCategories(categories)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Erro ao carregar configuracoes.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadSettings()
  }, [tenantSlug])

  useEffect(() => {
    let isMounted = true

    async function loadModelProfiles() {
      try {
        const profiles = await requestJson<AiModelProfile[]>("/api/superadmin/ai/profiles", { cache: "no-store" })
        if (!isMounted) return
        setModelProfiles(profiles.filter((profile) => profile.enabled))
      } catch {
        if (!isMounted) return
        setModelProfiles([])
      }
    }

    void loadModelProfiles()

    return () => {
      isMounted = false
    }
  }, [])

  function updateSection<T extends keyof NonNullable<TenantSettings>>(section: T, values: Partial<NonNullable<TenantSettings>[T]>) {
    setSettings((current) => {
      if (!current) return current
      const prev = current[section] as Record<string, unknown>
      const nextSettings = {
        ...current,
        [section]: { ...prev, ...values },
      }
      if (section === "branding" || section === "general") {
        emitBrandingUpdate(nextSettings)
      }

      return nextSettings
    })
  }

  function updateTeamMember(memberId: string, values: Partial<TenantSettingsTeamMember>) {
    setSettings((current) => current ? {
      ...current,
      team: {
        members: current.team.members.map((member) => member.id === memberId ? { ...member, ...values } : member),
      },
    } : current)
  }

  function addTeamMember() {
    const member: TenantSettingsTeamMember = {
      id: crypto.randomUUID(),
      name: "",
      email: "",
      role: "operator",
      status: "invited",
      password: "",
    }

    setSettings((current) => current ? {
      ...current,
      team: {
        members: [...current.team.members, member],
      },
    } : current)
  }

  function removeTeamMember(memberId: string) {
    setSettings((current) => current ? {
      ...current,
      team: {
        members: current.team.members.filter((member) => member.id !== memberId),
      },
    } : current)
  }

  async function saveSettings() {
    if (!settings || isSaving) return

    setIsSaving(true)
    setError(null)
    setNotice(null)

    try {
      const saved = await requestJson<TenantSettings>(`/api/tenant/${tenantSlug}/settings`, {
        method: "PATCH",
        body: JSON.stringify(settings),
      })
      setSettings(saved)
      const tokensData = await requestJson<TenantTokenSnapshot>(`/api/tenant/${tenantSlug}/billing/tokens`, { cache: "no-store" })
      setTokenSnapshot(tokensData)
      emitBrandingUpdate(saved)
      setNotice("Configuracoes salvas.")
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Erro ao salvar configuracoes.")
    } finally {
      setIsSaving(false)
    }
  }

  async function redeemCoupon() {
    const code = couponCode.trim()
    if (!code || isRedeemingCoupon) return

    setIsRedeemingCoupon(true)
    setError(null)
    setNotice(null)

    try {
      const payload = await requestJson<{ tokenSnapshot: TenantTokenSnapshot }>(`/api/tenant/${tenantSlug}/billing/coupons`, {
        method: "POST",
        body: JSON.stringify({ code }),
      })
      setTokenSnapshot(payload.tokenSnapshot)
      setCouponCode("")
      setNotice("Cupom aplicado. Créditos adicionados ao saldo.")
    } catch (couponError) {
      setError(couponError instanceof Error ? couponError.message : "Não foi possível aplicar o cupom.")
    } finally {
      setIsRedeemingCoupon(false)
    }
  }

  async function copyReferralUrl() {
    if (!referralProgram?.referralUrl) return
    await navigator.clipboard.writeText(referralProgram.referralUrl)
    setNotice("Link de indicação copiado.")
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <PageHeader
        title="configurações"
        subtitle={`tenant · ${tenantSlug}`}
        actions={
          <Button onClick={saveSettings} disabled={!settings || isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        }
      />

      {(error || notice) && (
        <div className={cn(
          "px-8 py-2 text-xs font-medium",
          error
            ? "bg-danger-soft text-danger-ink dark:bg-danger/30 dark:text-danger"
            : "bg-success-soft text-success-ink dark:bg-success/30 dark:text-success"
        )}>
          {error || notice}
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
          <Tabs
            className="mx-8 shrink-0"
            aria-label="Seções das configurações"
            value={activeSection}
            onValueChange={(next) => setActiveSection(next as SectionId)}
            items={sections.map((section) => ({ value: section.id, label: section.title }))}
          />

          <div className="min-h-0 overflow-auto px-8 py-6">
            {isLoading || !settings ? (
              <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando configuracoes...
              </div>
          ) : (
            <div className="w-full">
              {activeSection === "branding" && (
                <div className="grid items-start gap-x-12 max-xl:divide-y max-xl:divide-border xl:grid-cols-[minmax(0,1.7fr)_minmax(300px,1fr)]">
                  <SettingsGroup title="Identidade da marca" description="Logo, cores e dados que aparecem no portal do tenant.">
<div className="grid gap-4 md:grid-cols-2">
                      <Field label="Nome da empresa">
                        <TextInput value={settings.general.companyName} onChange={(event) => updateSection("general", { companyName: event.target.value })} />
                      </Field>
                      <Field label="Locale">
                        <TextInput value={settings.general.locale} onChange={(event) => updateSection("general", { locale: event.target.value })} />
                      </Field>
                      <div className="md:col-span-2">
                        <Field label="Tema e cor principal">
                          <p className="mb-3 text-xs text-muted-foreground">
                            Define a cor de destaque do painel (menu, botões, seleções). A logo da Como fica.ai não muda.
                          </p>
                          <div className="flex flex-wrap gap-2" role="group" aria-label="Temas">
                            {BRAND_PRESETS.map((preset) => (
                              <ToggleButton
                                key={preset.name}
                                selected={settings.branding.primaryColor.toLowerCase() === preset.primary.toLowerCase()}
                                onClick={() => updateSection("branding", { primaryColor: preset.primary })}
                              >
                                <span
                                  aria-hidden="true"
                                  className="mr-2 inline-block h-4 w-4 shrink-0 rounded-full align-middle shadow-[0_0_0_1px_rgba(0,0,0,0.18)]"
                                  style={{ background: preset.secondary ? `linear-gradient(135deg, ${preset.secondary} 50%, ${preset.primary} 50%)` : preset.primary }}
                                />
                                {preset.name}
                              </ToggleButton>
                            ))}
                          </div>
                          <div className="mt-4 grid max-w-md gap-3 sm:grid-cols-[72px_minmax(0,1fr)] sm:items-center">
                            <label className="relative h-12 w-full cursor-pointer overflow-hidden rounded-lg sm:h-10 sm:w-14" style={{ background: settings.branding.primaryColor }} title="Escolher outra cor">
                              <Input type="color" value={settings.branding.primaryColor} onChange={(event) => updateSection("branding", { primaryColor: event.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
                            </label>
                            <TextInput value={settings.branding.primaryColor} onChange={(event) => updateSection("branding", { primaryColor: event.target.value })} className="min-w-0 uppercase" />
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">Personalizado: escolha qualquer cor ou digite o código hexadecimal.</p>
                        </Field>
                      </div>
                      <div className="md:col-span-2">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Logo</span>
                        <div className="grid gap-4 md:grid-cols-[1fr_200px]">
                          <div
                            className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed border-border bg-background p-6 text-center transition-colors hover:border-primary/50"
                            onClick={() => document.getElementById("logo-upload")?.click()}
                            onDragOver={(e) => { e.preventDefault(); e.stopPropagation() }}
                            onDrop={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              const file = e.dataTransfer.files[0]
                              if (file) {
                                void applyLogoFile(file)
                              }
                            }}
                          >
                            {settings.branding.logoUrl ? (
                              <SafeImage
                                src={settings.branding.logoUrl}
                                alt="Logo"
                                className="max-h-[80px] max-w-full object-contain"
                                fallbackClassName="w-full"
                                fallbackLabel="Logo indisponível"
                                fallbackHint="Envie outro arquivo ou cole outra URL."
                              />
                            ) : (
                              <>
                                <Upload className="h-8 w-8 text-muted-foreground/50" />
                                <div>
                                  <p className="text-sm font-medium text-foreground">Arraste o logo ou clique para enviar</p>
                                  <p className="mt-1 text-xs text-muted-foreground">PNG, SVG ou JPG. Máx 2 MB.</p>
                                </div>
                              </>
                            )}
                            <Input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                void applyLogoFile(file)
                              }
                            }} />
                          </div>
                          <div className="space-y-2">
                            <span className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Persistência</span>
                            <div className="border-t border-border pt-3 text-sm text-muted-foreground">
                              O logo enviado fica salvo nas configurações do tenant e reaparece após recarregar a página.
                            </div>
                            {settings.branding.logoUrl && (
                              <Button
                                type="button"
                                variant="outline"
                                className="w-full"
                                onClick={() => updateSection("branding", { logoUrl: "" })}
                              >
                                Remover logo
                              </Button>
                            )}
                          </div>
                        </div>
                        <div className="mt-2">
                          <TextInput placeholder="Ou cole uma URL do logo" value={settings.branding.logoUrl} onChange={(event) => updateSection("branding", { logoUrl: event.target.value })} />
                        </div>
                      </div>
                      <Field label="Voz da marca" className="md:col-span-2">
                        <TextArea rows={4} value={settings.branding.brandVoice} onChange={(event) => updateSection("branding", { brandVoice: event.target.value })} />
                      </Field>
                      {/* Watermark: one column, one setting per row */}
                      <div className="md:col-span-2 border-t border-border pt-5">
                        <h4 className="mb-3 text-sm font-bold text-foreground">Marca d’água</h4>
                        <div className="grid max-w-xl gap-4">
                      <Toggle
                            checked={settings.branding.watermarkEnabled}
                            onChange={(checked) => updateSection("branding", { watermarkEnabled: checked })}
                            label="Aplicar marca d’água nas composições"
                          />
                          <Field label="Texto da marca d’água">
                            <TextInput
                              placeholder={settings.general.companyName || "ComoFica"}
                              value={settings.branding.watermarkText}
                              onChange={(event) => updateSection("branding", { watermarkText: event.target.value })}
                            />
                            <p className="mt-1 text-xs text-muted-foreground">Se ficar vazio, o sistema usa o nome da empresa do tenant.</p>
                          </Field>
                          <Field label="Posição da marca d’água">
                            <NativeSelect
                              value={settings.branding.watermarkPosition}
                              onChange={(event) => updateSection("branding", { watermarkPosition: event.target.value === "bottom-right" ? "bottom-right" : "center" })}
                              className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                            >
                              <option value="center">Centro</option>
                              <option value="bottom-right">Canto inferior direito</option>
                            </NativeSelect>
                          </Field>
                          <Field label={`Tamanho da marca d’água · ${settings.branding.watermarkSize ?? 100}%`}>
                            <Input
                              type="range"
                              min={50}
                              max={200}
                              step={5}
                              aria-label="Tamanho da marca d’água"
                              value={settings.branding.watermarkSize ?? 100}
                              onChange={(event) => updateSection("branding", { watermarkSize: Number(event.target.value) })}
                              className="w-full"
                            />
                            <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                              <span>Menor (50%)</span>
                              <button type="button" className="font-semibold underline-offset-2 hover:underline" onClick={() => updateSection("branding", { watermarkSize: 100 })}>Padrão (100%)</button>
                              <span>Maior (200%)</span>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">Vale para novas composições, tanto para texto quanto para logo, e aparece na pré-visualização ao lado.</p>
                          </Field>
                        </div>
                      </div>
                    </div>
                  </SettingsGroup>
                  <SettingsGroup title="Pré-visualização" description="Como a marca aparece para os clientes." className="xl:sticky xl:top-0 xl:pt-0">
<div className="grid gap-4">
                      {/* Sidebar preview */}
                      <div className="overflow-hidden rounded-md border border-border">
                        <div className="flex items-center gap-3 p-4" style={{ backgroundColor: settings.branding.primaryColor + "15" }}>
                          {settings.branding.logoUrl ? (
                            <SafeImage
                              src={settings.branding.logoUrl}
                              alt="Logo"
                              className="h-8 w-8 rounded-lg object-contain"
                              fallbackClassName="min-h-0 gap-0 p-0"
                              fallbackLabel="Logo"
                              fallbackHint=""
                            />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold" style={{ backgroundColor: settings.branding.primaryColor, color: getReadableTextColor(settings.branding.primaryColor) }}>
                              {settings.general.companyName?.[0]?.toUpperCase() || "C"}
                            </div>
                          )}
                          <span className="text-sm font-bold text-foreground">{settings.general.companyName || "Empresa"}</span>
                        </div>
                        <div className="space-y-1 p-3">
                          {["Inbox", "Composições", "Catálogo", "Contatos"].map((item) => (
                            <div key={item} className="rounded-lg px-3 py-2 text-xs text-muted-foreground">{item}</div>
                          ))}
                        </div>
                      </div>
                      {/* WhatsApp message preview */}
                      <div className="overflow-hidden rounded-md border border-border bg-[#e5ddd5] dark:bg-[#0b141a] p-4">
                        <div className="mb-2 text-center text-xs text-muted-foreground">WhatsApp</div>
                        <div className="flex flex-col gap-2">
                          <div className="self-start rounded-md rounded-tl-none bg-white dark:bg-[#202c33] px-3 py-1.5 text-xs text-foreground">
                            Olá! Gostaria de ver opções de decoração.
                          </div>
                          <div className="self-end rounded-md rounded-tr-none px-3 py-1.5 text-xs" style={{ backgroundColor: settings.branding.primaryColor, color: getReadableTextColor(settings.branding.primaryColor) }}>
                            Claro! Vou mostrar algumas opções. 😊
                          </div>
                        </div>
                      </div>
                      <div className="relative overflow-hidden rounded-md border border-border bg-black">
                        <SafeImage
                          src={settings.branding.logoUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='520' viewBox='0 0 800 520'%3E%3Crect width='800' height='520' fill='%23e5e7eb'/%3E%3Crect x='110' y='80' width='580' height='280' rx='18' fill='%23f8fafc'/%3E%3Crect x='160' y='120' width='260' height='180' rx='16' fill='%23d1fae5'/%3E%3Crect x='450' y='120' width='180' height='20' rx='10' fill='%239ca3af'/%3E%3Crect x='450' y='160' width='140' height='16' rx='8' fill='%23cbd5e1'/%3E%3Crect x='450' y='194' width='120' height='16' rx='8' fill='%23cbd5e1'/%3E%3Crect x='450' y='228' width='150' height='16' rx='8' fill='%23cbd5e1'/%3E%3Crect x='450' y='274' width='120' height='34' rx='17' fill='%2331c48d'/%3E%3C/svg%3E"}
                          alt="Prévia de composição"
                          className="h-56 w-full object-cover opacity-90"
                          fallbackLabel="Prévia indisponível"
                          fallbackHint="A imagem de prévia não carregou."
                        />
                        {settings.branding.watermarkEnabled && (
                          <div
                            className="pointer-events-none absolute inset-0 flex text-white/35"
                            style={{
                              alignItems: settings.branding.watermarkPosition === "bottom-right" ? "flex-end" : "center",
                              justifyContent: settings.branding.watermarkPosition === "bottom-right" ? "flex-end" : "center",
                              padding: settings.branding.watermarkPosition === "bottom-right" ? "16px" : "0",
                            }}
                          >
                            <span
                              className="rounded-md border border-white/10 bg-black/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]"
                              style={{
                                transform: `${settings.branding.watermarkPosition === "center" ? "rotate(-14deg) " : ""}scale(${(settings.branding.watermarkSize ?? 100) / 100})`,
                                transformOrigin: settings.branding.watermarkPosition === "bottom-right" ? "bottom right" : "center",
                              }}
                            >
                              {settings.branding.watermarkText || settings.general.companyName || "ComoFica"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </SettingsGroup>
                </div>
              )}

              {activeSection === "domain" && (
                <SettingsGroup title="Domínio" description="Configurações de domínio e canais do tenant.">
<div className="grid gap-4 md:grid-cols-2">
                    <Toggle checked={settings.channels.whatsappEnabled} onChange={(checked) => updateSection("channels", { whatsappEnabled: checked })} label="WhatsApp habilitado" />
                    <Toggle checked={settings.channels.instagramEnabled} onChange={(checked) => updateSection("channels", { instagramEnabled: checked })} label="Instagram habilitado" />
                    <Toggle checked={settings.channels.telegramEnabled} onChange={(checked) => updateSection("channels", { telegramEnabled: checked })} label="Telegram habilitado" />
                    <Toggle checked={settings.channels.autoSendCompositionsToWhatsapp} onChange={(checked) => updateSection("channels", { autoSendCompositionsToWhatsapp: checked })} label="Enviar composições do Estúdio no WhatsApp" />
                    <Field label="Handoff">
                      <NativeSelect
                        value={settings.channels.handoffMode}
                        onChange={(event) => updateSection("channels", { handoffMode: event.target.value === "auto" ? "auto" : "manual" })}
                        className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                      >
                        <option value="manual">Manual</option>
                        <option value="auto">Automatico</option>
                      </NativeSelect>
                    </Field>
                    <Field label="Dominios permitidos" className="md:col-span-2">
                      <TextArea rows={4} value={asLines(settings.security.allowedDomains)} onChange={(event) => updateSection("security", { allowedDomains: fromLines(event.target.value) })} />
                    </Field>
                  </div>
                </SettingsGroup>
              )}

              {activeSection === "assistant" && (
                <SettingsGroup title="IA & prompts" description="Configurações do assistente de IA e prompts do sistema.">
<div className="grid gap-4">
                    <Toggle checked={settings.assistant.enabled} onChange={(checked) => updateSection("assistant", { enabled: checked })} label="Assistente IA habilitado" />
                    <Toggle checked={settings.assistant.catalogEnabled} onChange={(checked) => updateSection("assistant", { catalogEnabled: checked })} label="Usar catálogo no WhatsApp" />
                    <p className="-mt-2 text-xs text-muted-foreground">
                      Desligado: a IA usa apenas referências enviadas pelo cliente no WhatsApp e não solicita produto ou link do catálogo.
                    </p>
                    <Field label="Nome do assistente">
                      <TextInput
                        value={settings.assistant.assistantName}
                        onChange={(event) => updateSection("assistant", { assistantName: event.target.value })}
                        placeholder="Yá"
                      />
                    </Field>
                    <Field label="Mensagem inicial no WhatsApp">
                      <TextArea
                        rows={4}
                        value={settings.assistant.welcomeMessage}
                        onChange={(event) => updateSection("assistant", { welcomeMessage: event.target.value })}
                        placeholder="Oi, seja bem-vindo à Décor Labs! Eu sou a Yá e estou aqui para ajudar."
                      />
                      <p className="text-xs text-muted-foreground">
                        Se ficar vazio, o sistema usa uma saudação automática com o nome da loja e do assistente.
                      </p>
                    </Field>
                    <Field label="Perfil de modelo">
                      {modelProfiles.length > 0 ? (
                        <NativeSelect
                          value={settings.assistant.modelProfileId}
                          onChange={(event) => updateSection("assistant", { modelProfileId: event.target.value })}
                          className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                        >
                          {modelProfiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                              {profile.name} · {profile.purpose} · {profile.modelId}
                            </option>
                          ))}
                        </NativeSelect>
                      ) : (
                        <TextInput value={settings.assistant.modelProfileId} onChange={(event) => updateSection("assistant", { modelProfileId: event.target.value })} />
                      )}
                      <p className="text-xs text-muted-foreground">
                        {modelProfiles.length > 0
                          ? "Perfis ativos carregados do cadastro global de IA."
                          : "Nenhum perfil global encontrado. Use o ID manualmente ate cadastrar um perfil no Superadmin."}
                      </p>
                    </Field>
                    <Field label="Prompt do sistema">
                      <TextArea rows={8} value={settings.assistant.systemPrompt} onChange={(event) => updateSection("assistant", { systemPrompt: event.target.value })} />
                    </Field>
                    <Field label="Categorias consultáveis no WhatsApp">
                      {catalogCategories.length === 0 ? (
                        <div className="border-t border-dashed border-border pt-4 text-sm text-muted-foreground">
                          Nenhuma categoria encontrada no catálogo. Cadastre produtos primeiro para liberar a seleção.
                        </div>
                      ) : (
                        <div className="space-y-3 border-t border-border pt-4">
                          <ToggleButton selected={settings.assistant.catalogCategories.length === 0} onClick={() => updateSection("assistant", { catalogCategories: [] })}>
                            Todas as categorias
                          </ToggleButton>
                          <div className="flex flex-wrap gap-2">
                            {catalogCategories.map((category) => {
                              const selected = settings.assistant.catalogCategories.includes(category)

                              return (
                                <ToggleButton selected={selected} key={category} onClick={() => updateSection("assistant", { catalogCategories: toggleListValue(settings.assistant.catalogCategories, category), })}>
                                  {category}
                                </ToggleButton>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        As opções vêm das categorias já cadastradas no catálogo. “Todas” deixa a Yá consultar qualquer categoria ativa.
                      </p>
                    </Field>
                    <Field label="Palavras para chamar operador">
                      <TextArea rows={4} value={asLines(settings.assistant.humanHandoffKeywords)} onChange={(event) => updateSection("assistant", { humanHandoffKeywords: fromLines(event.target.value) })} />
                    </Field>
                  </div>
                </SettingsGroup>
              )}

              {activeSection === "limits" && (
                <SettingsGroup title="Limites" description="Limites de uso e cotas do tenant.">
<div className="grid gap-4 md:grid-cols-2">
                    <Toggle checked={settings.security.twoFactorRequired} onChange={(checked) => updateSection("security", { twoFactorRequired: checked })} label="Exigir 2FA" />
                    <Field label="Timeout de sessao em minutos">
                      <TextInput type="number" min={15} value={settings.security.sessionTimeoutMinutes} onChange={(event) => updateSection("security", { sessionTimeoutMinutes: Number(event.target.value) })} />
                    </Field>
                  </div>
                </SettingsGroup>
              )}

              {activeSection === "team" && (
                <SettingsGroup title="Time" description="Membros e papeis do tenant.">
<div className="space-y-4">
                    <div className="flex justify-stretch sm:justify-end">
                      <Button variant="outline" className="w-full sm:w-auto" onClick={addTeamMember}>Adicionar membro</Button>
                    </div>
                    {settings.team.members.length === 0 ? (
                      <div className="border-t border-dashed border-border py-8 text-center text-sm text-muted-foreground">
                        Nenhum membro cadastrado neste tenant.
                      </div>
                    ) : settings.team.members.map((member) => (
                      <div key={member.id} className="space-y-3 border-t border-border pt-4">
                        <div className="grid gap-3 md:grid-cols-[1fr_1fr_140px_120px_auto]">
                        <TextInput placeholder="Nome" value={member.name} onChange={(event) => updateTeamMember(member.id, { name: event.target.value })} />
                        <TextInput placeholder="Email" value={member.email} onChange={(event) => updateTeamMember(member.id, { email: event.target.value })} />
                        <NativeSelect value={member.role} onChange={(event) => updateTeamMember(member.id, { role: event.target.value as TenantSettingsTeamMemberRole })} className="h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary">
                          <option value="admin">Admin</option>
                          <option value="operator">Operador</option>
                          <option value="viewer">Visualizador</option>
                        </NativeSelect>
                        <NativeSelect value={member.status} onChange={(event) => updateTeamMember(member.id, { status: event.target.value === "disabled" ? "disabled" : event.target.value === "invited" ? "invited" : "active" })} className="h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary">
                          <option value="active">Ativo</option>
                          <option value="invited">Convidado</option>
                          <option value="disabled">Desativado</option>
                        </NativeSelect>
                        <Button variant="outline" className="w-full md:w-auto" onClick={() => removeTeamMember(member.id)}>Remover</Button>
                        </div>
                        <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
                          <Field label={member.lastLoginAt ? "Redefinir senha (opcional)" : "Senha inicial"}>
                            <TextInput
                              type="password"
                              autoComplete="new-password"
                              placeholder={member.lastLoginAt ? "Preencha apenas para trocar a senha" : "Senha forte obrigatória"}
                              value={member.password ?? ""}
                              onChange={(event) => updateTeamMember(member.id, { password: event.target.value })}
                            />
                          </Field>
                          <div className="pb-1 text-xs text-muted-foreground">
                            {member.lastLoginAt
                              ? `Último acesso: ${new Date(member.lastLoginAt).toLocaleString("pt-BR")}`
                              : "Conta sem login registrado ainda."}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </SettingsGroup>
              )}

              {activeSection === "billing" && (
                <SettingsGroup title="Faturamento" description="Configuracoes de faturamento e notificacoes do tenant.">
<div className="grid gap-4 md:grid-cols-2">
                    <Toggle checked={settings.notifications.emailNotifications} onChange={(checked) => updateSection("notifications", { emailNotifications: checked })} label="Notificacoes por email" />
                    <Toggle checked={settings.notifications.whatsappNotifications} onChange={(checked) => updateSection("notifications", { whatsappNotifications: checked })} label="Notificacoes por WhatsApp" />
                    <Toggle checked={settings.notifications.jobFailureAlerts} onChange={(checked) => updateSection("notifications", { jobFailureAlerts: checked })} label="Alertar falhas de composicao" />
                    <Field label="Email do resumo diario">
                      <TextInput value={settings.notifications.dailySummaryEmail} onChange={(event) => updateSection("notifications", { dailySummaryEmail: event.target.value })} />
                    </Field>
                  </div>
                  {tokenSnapshot && (
                    <div className="mt-6 space-y-4">
                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="border-t border-border pt-4">
                          <div className="flex items-center gap-2">
                            <Gift className="h-4 w-4 text-primary" />
                            <h4 className="font-display text-base font-bold">Aplicar cupom</h4>
                          </div>
                          <p className="mt-1 text-xs text-muted-foreground">Cupons liberam créditos extras para composições.</p>
                          <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                            <TextInput
                              value={couponCode}
                              onChange={(event) => setCouponCode(event.target.value)}
                              placeholder="CODIGO"
                              className="uppercase"
                            />
                            <Button type="button" onClick={redeemCoupon} disabled={!couponCode.trim() || isRedeemingCoupon}>
                              {isRedeemingCoupon ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                              Aplicar
                            </Button>
                          </div>
                        </div>

                        <div className="border-t border-border pt-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h4 className="font-display text-base font-bold">Indicações</h4>
                              <p className="mt-1 text-xs text-muted-foreground">
                                Indicações convertidas liberam créditos extras uma única vez.
                              </p>
                            </div>
                            <span className={cn("rounded-full px-2.5 py-1 text-xs font-semibold uppercase", referralProgram?.settings.enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
                              {referralProgram?.settings.enabled ? "ativo" : "pausado"}
                            </span>
                          </div>
                          <div className="mt-4 border-t border-border pt-3">
                            <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Link de indicação</p>
                            <div className="mt-2 flex gap-2">
                              <Input
                                readOnly
                                value={referralProgram?.referralUrl ?? ""}
                                className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-xs text-foreground"
                              />
                              <Button type="button" variant="outline" size="sm" onClick={copyReferralUrl} disabled={!referralProgram?.referralUrl}>
                                <Copy className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                            <div className="border-t border-border pt-3">
                              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Convertidas</p>
                              <p className="mt-1 text-xl font-bold text-foreground">
                                {referralProgram?.referrals.filter((referral) => referral.status === "converted").length ?? 0}
                              </p>
                            </div>
                            <div className="border-t border-border pt-3">
                              <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">Créditos recebidos</p>
                              <p className="mt-1 text-xl font-bold text-foreground">
                                {referralProgram?.referrals.reduce((total, referral) => total + referral.creditsGranted, 0) ?? 0}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {tokenSnapshot.isExhausted ? (
                        <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                          Os tokens deste tenant acabaram. Novas composições ficam bloqueadas até receber crédito adicional.
                        </div>
                      ) : tokenSnapshot.isLowBalance ? (
                        <div className="rounded-md border border-warning/30 bg-warning/10 px-4 py-3 text-sm font-medium text-warning-ink">
                          Saldo baixo: restam {tokenSnapshot.account.balance} tokens. O limiar configurado é {tokenSnapshot.account.lowBalanceThreshold}.
                        </div>
                      ) : null}

                      <div className="grid gap-4 md:grid-cols-5">
                        <div className="border-t border-border pt-4">
                          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Saldo</p>
                          <p className="mt-2 text-2xl font-bold text-foreground">{tokenSnapshot.account.balance}</p>
                        </div>
                        <div className="border-t border-border pt-4">
                          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Plano incluído</p>
                          <p className="mt-2 text-2xl font-bold text-foreground">{tokenSnapshot.account.includedTokens}</p>
                        </div>
                        <div className="border-t border-border pt-4">
                          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Bônus</p>
                          <p className="mt-2 text-2xl font-bold text-foreground">{tokenSnapshot.account.bonusTokens}</p>
                        </div>
                        <div className="border-t border-border pt-4">
                          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Consumidos</p>
                          <p className="mt-2 text-2xl font-bold text-foreground">{tokenSnapshot.account.consumedTokens}</p>
                        </div>
                        <div className="border-t border-border pt-4">
                          <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Excedente</p>
                          <p className={cn("mt-2 text-2xl font-bold", tokenSnapshot.account.overageTokens > 0 ? "text-warning" : "text-foreground")}>
                            {tokenSnapshot.account.overageTokens}
                          </p>
                        </div>
                      </div>

                      <div className="border-y border-border">
                        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h4 className="font-display text-base font-bold">Histórico de tokens</h4>
                            <p className="text-xs text-muted-foreground">Últimos lançamentos registrados para este tenant.</p>
                          </div>
                          <span className="w-fit rounded-full border border-border px-3 py-1 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                            limiar baixo: {tokenSnapshot.account.lowBalanceThreshold}
                          </span>
                        </div>
                        <div className="divide-y divide-border">
                          {tokenSnapshot.entries.length === 0 ? (
                            <div className="px-4 py-6 text-sm text-muted-foreground">Nenhum lançamento registrado ainda.</div>
                          ) : tokenSnapshot.entries.map((entry) => (
                            <div key={entry.id} className="grid gap-2 px-4 py-3 md:grid-cols-[180px_1fr_100px_100px] md:items-center">
                              <div>
                                <p className="text-sm font-medium text-foreground">{new Date(entry.createdAt).toLocaleString("pt-BR")}</p>
                                <p className="text-xs uppercase tracking-[0.08em] text-muted-foreground">{entry.type}</p>
                              </div>
                              <div>
                                <p className="text-sm text-foreground">{entry.description}</p>
                                {entry.referenceId && (
                                  <p className="text-xs text-muted-foreground">ref: {entry.referenceId}</p>
                                )}
                              </div>
                              <div className={cn("text-sm font-semibold", entry.amount < 0 ? "text-destructive" : "text-success")}>
                                {formatSignedAmount(entry.amount)}
                              </div>
                              <div className="text-sm font-medium text-foreground">{entry.balanceAfter}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </SettingsGroup>
              )}
              </div>
            )}
          </div>
      </div>
    </div>
  )
}
