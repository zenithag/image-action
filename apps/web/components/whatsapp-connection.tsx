"use client"

import { useEffect, useMemo, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SafeImage } from "@/components/safe-image"
import { PageHeader } from "@/components/organisms/page-header"
import { Pill } from "@/components/spectrum"
import { cn } from "@/lib/utils"
import { ArrowRight, CheckCircle2, Loader2, Plus, QrCode, RefreshCw, Smartphone, Trash2, Unlink, XCircle } from "@/components/spectrum/icons"

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error"
type Step = "name" | "qrcode"

type TenantWhatsappInstance = {
  id: string
  tenantSlug: string
  channel: "whatsapp"
  providerId: string
  providerName: string
  name: string
  externalId?: string
  status: ConnectionStatus
  connected: boolean
  loggedIn: boolean
  qrcode?: string
  paircode?: string
  profileName?: string
  profilePicUrl?: string
  phoneNumber?: string
  syncStartedAt?: string
  lastSyncedAt?: string
  lastError?: string
  createdAt: string
  updatedAt: string
  instanceTokenConfigured?: boolean
}

type WhatsAppConnectionProps = {
  tenantSlug: string
}

function upsertInstance(instances: TenantWhatsappInstance[], nextInstance: TenantWhatsappInstance) {
  const exists = instances.some((instance) => instance.id === nextInstance.id)

  if (!exists) {
    return [nextInstance, ...instances]
  }

  return instances.map((instance) => instance.id === nextInstance.id ? nextInstance : instance)
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

export function WhatsAppConnection({ tenantSlug }: WhatsAppConnectionProps) {
  const [step, setStep] = useState<Step>("name")
  const [instances, setInstances] = useState<TenantWhatsappInstance[]>([])
  const [activeInstanceId, setActiveInstanceId] = useState<string | null>(null)
  const [, setIsLoadingInstances] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [deletingInstanceId, setDeletingInstanceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connectionName, setConnectionName] = useState("")
  const [savedName, setSavedName] = useState("")

  const activeInstance = useMemo(
    () => instances.find((instance) => instance.id === activeInstanceId) ?? null,
    [instances, activeInstanceId]
  )
  const status: ConnectionStatus = activeInstance?.status ?? "disconnected"
  const canReconnectActiveInstance = Boolean(activeInstance && activeInstance.status !== "connected")
  const qrCode = canReconnectActiveInstance ? activeInstance?.qrcode : undefined

  const applyActiveInstance = (instance: TenantWhatsappInstance) => {
    setActiveInstanceId(instance.id)

    if (instance.status === "connected") {
      setConnectionName("")
      setSavedName("")
      setStep("name")
      return
    }

    setConnectionName("")
    setSavedName(instance.name)
    setStep("qrcode")
  }

  useEffect(() => {
    let isMounted = true

    async function loadInstances() {
      setIsLoadingInstances(true)
      setError(null)

      try {
        const response = await fetch(`/api/tenant/${tenantSlug}/whatsapp/instances`, { cache: "no-store" })

        if (!response.ok) {
          throw new Error("Nao foi possivel carregar as conexoes WhatsApp.")
        }

        const data = await response.json() as TenantWhatsappInstance[]

        if (!isMounted) return

        setInstances(data)

        const preferredInstance = data.find((instance) => instance.status === "connecting") ??
          data.find((instance) => instance.status === "connected") ??
          data[0]

        if (preferredInstance) {
          applyActiveInstance(preferredInstance)
        }
      } catch (loadError) {
        if (isMounted) {
          setError(loadError instanceof Error ? loadError.message : "Erro ao carregar conexoes.")
        }
      } finally {
        if (isMounted) {
          setIsLoadingInstances(false)
        }
      }
    }

    void loadInstances()

    return () => {
      isMounted = false
    }
  }, [tenantSlug])

  useEffect(() => {
    if (!activeInstance || activeInstance.status !== "connecting") {
      return
    }

    const intervalId = window.setInterval(() => {
      void refreshStatus(activeInstance.id, { silent: true })
    }, 8000)

    return () => window.clearInterval(intervalId)
  }, [activeInstance?.id, activeInstance?.status])

  const handleSaveName = () => {
    const trimmedName = connectionName.trim()
    if (!trimmedName) return

    setSavedName(trimmedName)
    setActiveInstanceId(null)
    setStep("qrcode")
    setError(null)
  }

  const generateQRCode = async () => {
    const name = savedName.trim()
    if (!name || isLoading) return

    const shouldCreateNewInstance = !activeInstance || activeInstance.status === "connected"

    setIsLoading(true)
    setError(null)

    try {
      const response = !shouldCreateNewInstance && activeInstance
        ? await fetch(`/api/tenant/${tenantSlug}/whatsapp/instances/${activeInstance.id}/connect`, {
            method: "POST",
          })
        : await fetch(`/api/tenant/${tenantSlug}/whatsapp/instances`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          })

      const payload = await response.json() as TenantWhatsappInstance | { error?: string; instance?: TenantWhatsappInstance }

      if (!response.ok) {
        const fallbackInstance = "instance" in payload ? payload.instance : undefined
        if (fallbackInstance) {
          setInstances((current) => upsertInstance(current, fallbackInstance))
          setActiveInstanceId(fallbackInstance.id)
        }

        throw new Error("error" in payload && payload.error ? payload.error : "Nao foi possivel gerar o QR Code.")
      }

      const instance = payload as TenantWhatsappInstance
      setInstances((current) => upsertInstance(current, instance))
      applyActiveInstance(instance)

      if (!instance.qrcode && !instance.connected && !instance.paircode) {
        setError("Instancia criada, mas o provedor ainda nao retornou QR Code. Clique em Atualizar QR Code.")
      }
    } catch (qrError) {
      setError(qrError instanceof Error ? qrError.message : "Erro ao gerar QR Code.")
    } finally {
      setIsLoading(false)
    }
  }

  const refreshStatus = async (instanceId = activeInstanceId, options?: { silent?: boolean }) => {
    if (!instanceId || (!options?.silent && isLoading)) return

    if (!options?.silent) {
      setIsLoading(true)
      setError(null)
    }

    try {
      const response = await fetch(`/api/tenant/${tenantSlug}/whatsapp/instances/${instanceId}/status`, {
        cache: "no-store",
      })
      const payload = await response.json() as TenantWhatsappInstance | { error?: string; instance?: TenantWhatsappInstance }

      if (!response.ok) {
        const fallbackInstance = "instance" in payload ? payload.instance : undefined
        if (fallbackInstance) {
          setInstances((current) => upsertInstance(current, fallbackInstance))
        }

        throw new Error("error" in payload && payload.error ? payload.error : "Nao foi possivel consultar o status.")
      }

      const instance = payload as TenantWhatsappInstance
      setInstances((current) => upsertInstance(current, instance))
      applyActiveInstance(instance)
    } catch (statusError) {
      if (!options?.silent) {
        setError(statusError instanceof Error ? statusError.message : "Erro ao consultar status.")
      }
    } finally {
      if (!options?.silent) {
        setIsLoading(false)
      }
    }
  }

  const startNewConnection = () => {
    setConnectionName("")
    setSavedName("")
    setActiveInstanceId(null)
    setStep("name")
    setError(null)
  }

  const selectInstance = (instance: TenantWhatsappInstance) => {
    applyActiveInstance(instance)
    setError(null)
  }

  const deleteInstance = async (instance: TenantWhatsappInstance) => {
    if (deletingInstanceId) return

    const shouldDelete = window.confirm(`Remover a instancia "${instance.name}" deste tenant? O sistema tambem tentara remover essa conexão no provedor.`)
    if (!shouldDelete) return

    setDeletingInstanceId(instance.id)
    setError(null)

    try {
      const response = await fetch(`/api/tenant/${tenantSlug}/whatsapp/instances/${instance.id}`, {
        method: "DELETE",
      })
      const payload = await response.json().catch(() => null) as { error?: string } | null

      if (!response.ok) {
        throw new Error(payload?.error || "Nao foi possivel remover a instancia.")
      }

      const nextInstances = instances.filter((item) => item.id !== instance.id)
      setInstances(nextInstances)

      if (activeInstanceId === instance.id) {
        const nextActiveInstance = nextInstances.find((item) => item.status === "connecting") ??
          nextInstances.find((item) => item.status === "connected") ??
          nextInstances[0]

        if (nextActiveInstance) {
          applyActiveInstance(nextActiveInstance)
        } else {
          startNewConnection()
        }
      }
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Erro ao remover instancia.")
    } finally {
      setDeletingInstanceId(null)
    }
  }

  const statusPill = (() => {
    switch (status) {
      case "connected":
        return <Pill tone="success"><CheckCircle2 className="h-3.5 w-3.5" />Conectado</Pill>
      case "connecting":
        return <Pill tone="warning"><RefreshCw className="h-3.5 w-3.5 animate-spin" />Aguardando leitura</Pill>
      case "error":
        return <Pill tone="danger"><XCircle className="h-3.5 w-3.5" />Erro</Pill>
      default:
        return <Pill><Unlink className="h-3.5 w-3.5" />Desconectado</Pill>
    }
  })()

  const isConnected = activeInstance?.status === "connected"

  return (
    <div className="flex h-full min-w-0 flex-col bg-background">
      <PageHeader
        title="whatsapp"
        subtitle={`canal · ${isConnected ? "conectado" : "sem instância"}`}
        actions={statusPill}
      />

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* Instances: same pattern as the inbox list */}
        <aside className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
          <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
            <h2 className="text-sm font-bold text-foreground">
              Instâncias <span className="cf-count">{instances.length}</span>
            </h2>
            <Button variant="ghost" onClick={startNewConnection}>
              <Plus className="h-4 w-4" />
              Nova
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {instances.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">Nenhuma instância conectada ainda.</p>
            ) : (
              instances.map((instance) => (
                <div
                  key={instance.id}
                  className={cn(
                    "group flex items-center gap-2 border-b border-border/60 pr-2 transition-colors",
                    activeInstanceId === instance.id
                      ? "bg-[var(--cf-accent-soft,var(--muted))]"
                      : "hover:bg-[var(--cf-surface-hover,var(--muted))]"
                  )}
                >
                  <button
                    type="button"
                    onClick={() => selectInstance(instance)}
                    aria-current={activeInstanceId === instance.id ? "true" : undefined}
                    className="flex min-w-0 flex-1 items-center gap-3 px-4 py-3 text-left"
                  >
                    <InstanceStatusIcon status={instance.status} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-foreground">{instance.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {instance.phoneNumber ? `+${instance.phoneNumber}` : formatDate(instance.updatedAt)}
                      </span>
                    </span>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remover ${instance.name}`}
                    title="Remover instância"
                    onClick={() => deleteInstance(instance)}
                    disabled={deletingInstanceId === instance.id}
                  >
                    {deletingInstanceId === instance.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                  </Button>
                </div>
              ))
            )}
          </div>
        </aside>

        <main className="min-h-0 min-w-0 overflow-y-auto">
          <div className="mx-auto max-w-3xl divide-y divide-border px-8">
            {/* Selected instance, or the first step of connecting one */}
            <section className="py-6">
              {isConnected && activeInstance ? (
                <>
                  <div className="flex flex-wrap items-center gap-4">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--cf-accent-soft,var(--muted))] text-[var(--cf-accent-ink,var(--foreground))]">
                      <Smartphone className="h-6 w-6" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h2 className="truncate text-lg font-bold text-foreground">
                        {activeInstance.phoneNumber ? `+${activeInstance.phoneNumber}` : "Número não disponível"}
                      </h2>
                      <p className="truncate text-sm text-muted-foreground">
                        {activeInstance.profileName || "Perfil não identificado"} · {activeInstance.name}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button variant="outline" onClick={() => refreshStatus(activeInstance.id)} disabled={isLoading}>
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} />
                        Atualizar
                      </Button>
                      <Button variant="outline" onClick={() => deleteInstance(activeInstance)} disabled={deletingInstanceId === activeInstance.id}>
                        {deletingInstanceId === activeInstance.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        Remover
                      </Button>
                    </div>
                  </div>

                  <dl className="mt-6 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-3">
                    {[
                      ["Criada em", formatDate(activeInstance.createdAt)],
                      ["Última sincronização", activeInstance.lastSyncedAt ? formatDate(activeInstance.lastSyncedAt) : "pendente"],
                      ["Status real", activeInstance.loggedIn ? "logado" : activeInstance.connected ? "conectado" : activeInstance.status],
                    ].map(([label, value]) => (
                      <div key={label}>
                        <dt className="text-xs font-semibold text-muted-foreground">{label}</dt>
                        <dd className="mt-1 text-sm font-semibold text-foreground">{value}</dd>
                      </div>
                    ))}
                  </dl>

                  {activeInstance.lastError && (
                    <Alert variant="destructive" className="mt-5">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>{activeInstance.lastError}</AlertDescription>
                    </Alert>
                  )}
                </>
              ) : (
                <>
                  <h2 className="text-lg font-bold text-foreground">Conectar WhatsApp</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {step === "name" ? "Dê um nome para identificar este número na plataforma." : "Gerando QR Code..."}
                  </p>
                  {step === "name" && (
                    <div className="mt-5 max-w-sm space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="connection-name" className="text-xs font-semibold text-muted-foreground">
                          Nome da instância
                        </Label>
                        <Input
                          id="connection-name"
                          placeholder="Ex.: Loja Principal"
                          className="w-full"
                          value={connectionName}
                          onChange={(event) => setConnectionName(event.target.value)}
                          onKeyDown={(event) => event.key === "Enter" && handleSaveName()}
                        />
                      </div>
                      <Button onClick={handleSaveName} disabled={!connectionName.trim()}>
                        Continuar <ArrowRight className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
            </section>

            {/* New instance / QR code */}
            <section className="py-6">
              <h2 className="text-lg font-bold text-foreground">Adicionar nova instância</h2>
              <p className="mt-1 text-sm text-muted-foreground">Escaneie o QR Code com o WhatsApp do aparelho.</p>

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="mt-5 flex flex-col items-center">
                {qrCode ? (
                  <>
                    <div className="rounded-xl bg-white p-4 shadow-[0_0_0_1px_var(--border)]">
                      <SafeImage
                        src={qrCode}
                        alt="QR Code WhatsApp"
                        className="h-48 w-48 sm:h-56 sm:w-56"
                        fallbackLabel="QR indisponível"
                        fallbackHint="Gere um novo QR Code."
                      />
                    </div>
                    <div className="mt-4">
                      <Pill tone="warning"><RefreshCw className="h-3.5 w-3.5 animate-spin" />Aguardando leitura</Pill>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                      <Button variant="outline" onClick={generateQRCode} disabled={isLoading}>
                        <RefreshCw className={cn("h-4 w-4", isLoading && "animate-spin")} /> Atualizar QR
                      </Button>
                      <Button onClick={() => refreshStatus()} disabled={isLoading}>
                        <CheckCircle2 className="h-4 w-4" /> Verificar
                      </Button>
                    </div>
                  </>
                ) : step === "name" && instances.length > 0 ? (
                  <div className="w-full max-w-sm space-y-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="new-connection-name" className="text-xs font-semibold text-muted-foreground">
                        Nome da nova instância
                      </Label>
                      <Input
                        id="new-connection-name"
                        placeholder="Ex.: Loja 2"
                        className="w-full"
                        value={connectionName}
                        onChange={(event) => setConnectionName(event.target.value)}
                        onKeyDown={(event) => event.key === "Enter" && handleSaveName()}
                      />
                    </div>
                    <Button onClick={handleSaveName} disabled={!connectionName.trim()}>
                      Continuar <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-4 text-center">
                    <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--cf-surface-sunken,var(--muted))] text-muted-foreground">
                      <QrCode className="h-8 w-8" />
                    </span>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {savedName ? "Clique abaixo para gerar o QR Code da nova instância." : "Informe o nome da instância primeiro."}
                    </p>
                    <Button className="mt-4" onClick={generateQRCode} disabled={isLoading || !savedName}>
                      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                      Gerar QR Code
                    </Button>
                  </div>
                )}
              </div>

              {savedName && (
                <p className="mt-5 text-sm text-muted-foreground">
                  Nome da conexão: <span className="font-semibold text-foreground">{savedName}</span>
                </p>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  )
}

function InstanceStatusIcon({ status }: { status: ConnectionStatus }) {
  if (status === "connected") {
    return <CheckCircle2 className="h-4 w-4 text-primary" />
  }

  if (status === "connecting") {
    return <RefreshCw className="h-4 w-4 animate-spin text-warning" />
  }

  if (status === "error") {
    return <XCircle className="h-4 w-4 text-destructive" />
  }

  return <Unlink className="h-4 w-4 text-muted-foreground" />
}
