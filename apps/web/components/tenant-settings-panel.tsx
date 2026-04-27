"use client"

import { useEffect, useState, type ReactNode } from "react"
import { Loader2, Save, Upload } from "lucide-react"

import { SafeImage } from "@/components/safe-image"
import { Button } from "@/components/ui/button"
import type { AiModelProfile } from "@/lib/ai-types"
import type { CatalogItem } from "@/lib/catalog-types"
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

const BRAND_PRESETS = [
  { name: "ComoFica (padrão)", primary: "#00AF67" },
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
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
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
    <textarea
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
      className="flex items-center justify-between rounded-xl border border-border bg-background p-4 text-left transition-colors hover:border-primary/50"
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
  const [catalogCategories, setCatalogCategories] = useState<string[]>([])

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
      const [settingsData, tokensData, catalogItems] = await Promise.all([
        requestJson<TenantSettings>(`/api/tenant/${tenantSlug}/settings`, { cache: "no-store" }),
        requestJson<TenantTokenSnapshot>(`/api/tenant/${tenantSlug}/billing/tokens`, { cache: "no-store" }),
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

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <div className="border-b border-border bg-card px-4 py-5 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">Tenant</p>
            <h1 className="mt-1 font-display text-2xl font-bold text-foreground">Configurações</h1>
            <p className="mt-1 text-sm text-muted-foreground">Configurações persistidas do tenant {tenantSlug}.</p>
          </div>
          <Button className="w-full sm:w-fit" onClick={saveSettings} disabled={!settings || isSaving}>
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Salvar alterações
          </Button>
        </div>
      </div>

      {(error || notice) && (
        <div className={cn(
          "px-4 py-3 text-sm font-medium sm:px-6",
          error
            ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
            : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300"
        )}>
          {error || notice}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[auto_minmax(0,1fr)] overflow-hidden lg:grid-cols-[220px_minmax(0,1fr)] lg:grid-rows-1">
          {/* Sidebar nav — matches prototype settings-grid */}
          <nav className="flex min-w-0 gap-2 overflow-x-auto border-b border-border bg-card p-3 scrollbar-hide lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r lg:p-4">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => setActiveSection(section.id)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-left text-sm font-medium transition-colors lg:rounded-[10px] lg:px-3",
                  activeSection === section.id
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-primary/5 hover:text-primary"
                )}
              >
                {section.title}
              </button>
            ))}
          </nav>

          <div className="min-h-0 overflow-auto p-4 sm:p-6">
            {isLoading || !settings ? (
              <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Carregando configuracoes...
              </div>
          ) : (
            <div className="mx-auto w-full max-w-4xl space-y-6">
              {activeSection === "branding" && (
                <div className="space-y-6">
                  <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
                    <h3 className="font-display text-lg font-bold">Identidade da marca</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Logo, cores e dados que aparecem no portal do tenant.</p>
                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      <Field label="Nome da empresa">
                        <TextInput value={settings.general.companyName} onChange={(event) => updateSection("general", { companyName: event.target.value })} />
                      </Field>
                      <Field label="Locale">
                        <TextInput value={settings.general.locale} onChange={(event) => updateSection("general", { locale: event.target.value })} />
                      </Field>
                      <Field label="Cor principal">
                        <div className="grid gap-3 sm:grid-cols-[72px_minmax(0,1fr)] sm:items-center">
                          <label className="relative h-12 w-full cursor-pointer overflow-hidden rounded-lg sm:h-10 sm:w-14" style={{ background: settings.branding.primaryColor }}>
                            <input type="color" value={settings.branding.primaryColor} onChange={(event) => updateSection("branding", { primaryColor: event.target.value })} className="absolute inset-0 cursor-pointer opacity-0" />
                          </label>
                          <TextInput value={settings.branding.primaryColor} onChange={(event) => updateSection("branding", { primaryColor: event.target.value })} className="min-w-0 font-mono uppercase" />
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {BRAND_PRESETS.map((preset) => (
                            <button
                              key={preset.name}
                              type="button"
                              title={preset.name}
                              onClick={() => updateSection("branding", { primaryColor: preset.primary })}
                              className="h-7 w-7 rounded-lg border border-border transition-transform hover:scale-110"
                              style={{
                                background: preset.primary,
                                outline: settings.branding.primaryColor.toLowerCase() === preset.primary.toLowerCase() ? "2px solid var(--foreground)" : "none",
                                outlineOffset: 2,
                              }}
                            />
                          ))}
                        </div>
                      </Field>
                      <div className="md:col-span-2">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Logo</span>
                        <div className="grid gap-4 md:grid-cols-[1fr_200px]">
                          <div
                            className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-background p-6 text-center transition-colors hover:border-primary/50"
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
                            <input id="logo-upload" type="file" accept="image/*" className="hidden" onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) {
                                void applyLogoFile(file)
                              }
                            }} />
                          </div>
                          <div className="space-y-2">
                            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Persistência</span>
                            <div className="rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
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
                        <select
                          value={settings.branding.watermarkPosition}
                          onChange={(event) => updateSection("branding", { watermarkPosition: event.target.value === "bottom-right" ? "bottom-right" : "center" })}
                          className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                        >
                          <option value="center">Centro</option>
                          <option value="bottom-right">Canto inferior direito</option>
                        </select>
                      </Field>
                    </div>
                  </div>
                  <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
                    <h3 className="font-display text-lg font-bold">Pré-visualização</h3>
                    <p className="mt-1 text-sm text-muted-foreground">Como a marca aparece para os clientes.</p>
                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      {/* Sidebar preview */}
                      <div className="overflow-hidden rounded-xl border border-border">
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
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white" style={{ backgroundColor: settings.branding.primaryColor }}>
                              {settings.general.companyName?.[0]?.toUpperCase() || "C"}
                            </div>
                          )}
                          <span className="text-sm font-bold" style={{ color: settings.branding.primaryColor }}>{settings.general.companyName || "Empresa"}</span>
                        </div>
                        <div className="space-y-1 p-3">
                          {["Inbox", "Composições", "Catálogo", "Contatos"].map((item) => (
                            <div key={item} className="rounded-lg px-3 py-2 text-xs text-muted-foreground">{item}</div>
                          ))}
                        </div>
                      </div>
                      {/* WhatsApp message preview */}
                      <div className="overflow-hidden rounded-xl border border-border bg-[#e5ddd5] dark:bg-[#0b141a] p-4">
                        <div className="mb-2 text-center text-[10px] text-muted-foreground">WhatsApp</div>
                        <div className="flex flex-col gap-2">
                          <div className="self-start rounded-lg rounded-tl-none bg-white dark:bg-[#202c33] px-3 py-1.5 text-xs text-foreground shadow-sm">
                            Olá! Gostaria de ver opções de decoração.
                          </div>
                          <div className="self-end rounded-lg rounded-tr-none px-3 py-1.5 text-xs text-white shadow-sm" style={{ backgroundColor: settings.branding.primaryColor }}>
                            Claro! Vou mostrar algumas opções. 😊
                          </div>
                        </div>
                      </div>
                      <div className="relative overflow-hidden rounded-xl border border-border bg-black">
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
                                transform: settings.branding.watermarkPosition === "center" ? "rotate(-14deg)" : "none",
                              }}
                            >
                              {settings.branding.watermarkText || settings.general.companyName || "ComoFica"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeSection === "domain" && (
                <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
                  <h3 className="font-display text-lg font-bold">Domínio</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Configurações de domínio e canais do tenant.</p>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <Toggle checked={settings.channels.whatsappEnabled} onChange={(checked) => updateSection("channels", { whatsappEnabled: checked })} label="WhatsApp habilitado" />
                    <Toggle checked={settings.channels.instagramEnabled} onChange={(checked) => updateSection("channels", { instagramEnabled: checked })} label="Instagram habilitado" />
                    <Toggle checked={settings.channels.telegramEnabled} onChange={(checked) => updateSection("channels", { telegramEnabled: checked })} label="Telegram habilitado" />
                    <Toggle checked={settings.channels.autoSendCompositionsToWhatsapp} onChange={(checked) => updateSection("channels", { autoSendCompositionsToWhatsapp: checked })} label="Enviar composição pronta no WhatsApp" />
                    <Field label="Handoff">
                      <select
                        value={settings.channels.handoffMode}
                        onChange={(event) => updateSection("channels", { handoffMode: event.target.value === "auto" ? "auto" : "manual" })}
                        className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                      >
                        <option value="manual">Manual</option>
                        <option value="auto">Automatico</option>
                      </select>
                    </Field>
                    <Field label="Dominios permitidos" className="md:col-span-2">
                      <TextArea rows={4} value={asLines(settings.security.allowedDomains)} onChange={(event) => updateSection("security", { allowedDomains: fromLines(event.target.value) })} />
                    </Field>
                  </div>
                </div>
              )}

              {activeSection === "assistant" && (
                <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
                  <h3 className="font-display text-lg font-bold">IA & prompts</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Configurações do assistente de IA e prompts do sistema.</p>
                  <div className="mt-6 grid gap-4">
                    <Toggle checked={settings.assistant.enabled} onChange={(checked) => updateSection("assistant", { enabled: checked })} label="Assistente IA habilitado" />
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
                        <select
                          value={settings.assistant.modelProfileId}
                          onChange={(event) => updateSection("assistant", { modelProfileId: event.target.value })}
                          className="h-11 w-full rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary"
                        >
                          {modelProfiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                              {profile.name} · {profile.purpose} · {profile.modelId}
                            </option>
                          ))}
                        </select>
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
                        <div className="rounded-xl border border-dashed border-border bg-background p-4 text-sm text-muted-foreground">
                          Nenhuma categoria encontrada no catálogo. Cadastre produtos primeiro para liberar a seleção.
                        </div>
                      ) : (
                        <div className="space-y-3 rounded-xl border border-border bg-background p-4">
                          <button
                            type="button"
                            onClick={() => updateSection("assistant", { catalogCategories: [] })}
                            className={cn(
                              "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                              settings.assistant.catalogCategories.length === 0
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                            )}
                          >
                            Todas as categorias
                          </button>
                          <div className="flex flex-wrap gap-2">
                            {catalogCategories.map((category) => {
                              const selected = settings.assistant.catalogCategories.includes(category)

                              return (
                                <button
                                  key={category}
                                  type="button"
                                  onClick={() => updateSection("assistant", {
                                    catalogCategories: toggleListValue(settings.assistant.catalogCategories, category),
                                  })}
                                  className={cn(
                                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                                    selected
                                      ? "border-primary bg-primary text-primary-foreground"
                                      : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                                  )}
                                >
                                  {category}
                                </button>
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
                </div>
              )}

              {activeSection === "limits" && (
                <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
                  <h3 className="font-display text-lg font-bold">Limites</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Limites de uso e cotas do tenant.</p>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <Toggle checked={settings.security.twoFactorRequired} onChange={(checked) => updateSection("security", { twoFactorRequired: checked })} label="Exigir 2FA" />
                    <Field label="Timeout de sessao em minutos">
                      <TextInput type="number" min={15} value={settings.security.sessionTimeoutMinutes} onChange={(event) => updateSection("security", { sessionTimeoutMinutes: Number(event.target.value) })} />
                    </Field>
                  </div>
                </div>
              )}

              {activeSection === "team" && (
                <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
                  <h3 className="font-display text-lg font-bold">Time</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Membros e papeis do tenant.</p>
                  <div className="mt-6 space-y-4">
                    <div className="flex justify-stretch sm:justify-end">
                      <Button variant="outline" className="w-full sm:w-auto" onClick={addTeamMember}>Adicionar membro</Button>
                    </div>
                    {settings.team.members.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                        Nenhum membro cadastrado neste tenant.
                      </div>
                    ) : settings.team.members.map((member) => (
                      <div key={member.id} className="space-y-3 rounded-xl border border-border bg-background p-4">
                        <div className="grid gap-3 md:grid-cols-[1fr_1fr_140px_120px_auto]">
                        <TextInput placeholder="Nome" value={member.name} onChange={(event) => updateTeamMember(member.id, { name: event.target.value })} />
                        <TextInput placeholder="Email" value={member.email} onChange={(event) => updateTeamMember(member.id, { email: event.target.value })} />
                        <select value={member.role} onChange={(event) => updateTeamMember(member.id, { role: event.target.value as TenantSettingsTeamMemberRole })} className="h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary">
                          <option value="admin">Admin</option>
                          <option value="operator">Operador</option>
                          <option value="viewer">Visualizador</option>
                        </select>
                        <select value={member.status} onChange={(event) => updateTeamMember(member.id, { status: event.target.value === "disabled" ? "disabled" : event.target.value === "invited" ? "invited" : "active" })} className="h-11 rounded-lg border border-border bg-background px-3 text-sm outline-none focus:border-primary">
                          <option value="active">Ativo</option>
                          <option value="invited">Convidado</option>
                          <option value="disabled">Desativado</option>
                        </select>
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
                </div>
              )}

              {activeSection === "billing" && (
                <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
                  <h3 className="font-display text-lg font-bold">Faturamento</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Configuracoes de faturamento e notificacoes do tenant.</p>
                  <div className="mt-6 grid gap-4 md:grid-cols-2">
                    <Toggle checked={settings.notifications.emailNotifications} onChange={(checked) => updateSection("notifications", { emailNotifications: checked })} label="Notificacoes por email" />
                    <Toggle checked={settings.notifications.whatsappNotifications} onChange={(checked) => updateSection("notifications", { whatsappNotifications: checked })} label="Notificacoes por WhatsApp" />
                    <Toggle checked={settings.notifications.jobFailureAlerts} onChange={(checked) => updateSection("notifications", { jobFailureAlerts: checked })} label="Alertar falhas de composicao" />
                    <Field label="Email do resumo diario">
                      <TextInput value={settings.notifications.dailySummaryEmail} onChange={(event) => updateSection("notifications", { dailySummaryEmail: event.target.value })} />
                    </Field>
                  </div>
                  {tokenSnapshot && (
                    <div className="mt-6 space-y-4">
                      {tokenSnapshot.isExhausted ? (
                        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                          Os tokens deste tenant acabaram. Novas composições ficam bloqueadas até receber crédito adicional.
                        </div>
                      ) : tokenSnapshot.isLowBalance ? (
                        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-700">
                          Saldo baixo: restam {tokenSnapshot.account.balance} tokens. O limiar configurado é {tokenSnapshot.account.lowBalanceThreshold}.
                        </div>
                      ) : null}

                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="rounded-xl border border-border bg-background p-4">
                          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Saldo</p>
                          <p className="mt-2 text-2xl font-bold text-foreground">{tokenSnapshot.account.balance}</p>
                        </div>
                        <div className="rounded-xl border border-border bg-background p-4">
                          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Plano incluído</p>
                          <p className="mt-2 text-2xl font-bold text-foreground">{tokenSnapshot.account.includedTokens}</p>
                        </div>
                        <div className="rounded-xl border border-border bg-background p-4">
                          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Consumidos</p>
                          <p className="mt-2 text-2xl font-bold text-foreground">{tokenSnapshot.account.consumedTokens}</p>
                        </div>
                        <div className="rounded-xl border border-border bg-background p-4">
                          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Excedente</p>
                          <p className={cn("mt-2 text-2xl font-bold", tokenSnapshot.account.overageTokens > 0 ? "text-amber-600" : "text-foreground")}>
                            {tokenSnapshot.account.overageTokens}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border border-border bg-background">
                        <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h4 className="font-display text-base font-bold">Histórico de tokens</h4>
                            <p className="text-xs text-muted-foreground">Últimos lançamentos registrados para este tenant.</p>
                          </div>
                          <span className="w-fit rounded-full border border-border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
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
                                <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{entry.type}</p>
                              </div>
                              <div>
                                <p className="text-sm text-foreground">{entry.description}</p>
                                {entry.referenceId && (
                                  <p className="text-xs text-muted-foreground">ref: {entry.referenceId}</p>
                                )}
                              </div>
                              <div className={cn("text-sm font-semibold", entry.amount < 0 ? "text-destructive" : "text-emerald-600")}>
                                {formatSignedAmount(entry.amount)}
                              </div>
                              <div className="text-sm font-medium text-foreground">{entry.balanceAfter}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              </div>
            )}
          </div>
      </div>
    </div>
  )
}
