"use client"

import { useEffect, useMemo, useState } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SafeImage } from "@/components/safe-image"
import { cn } from "@/lib/utils"
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  QrCode,
  RefreshCw,
  Smartphone,
  Trash2,
  Unlink,
  XCircle,
} from "lucide-react"

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

  const getStatusBadge = () => {
    switch (status) {
      case "connected":
        return (
          <Badge className="shrink-0 whitespace-nowrap rounded border-primary/20 bg-primary/10 text-primary">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Conectado
          </Badge>
        )
      case "connecting":
        return (
          <Badge className="shrink-0 whitespace-nowrap rounded border-amber-500/20 bg-amber-500/10 text-amber-500">
            <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
            Aguardando leitura
          </Badge>
        )
      case "error":
        return (
          <Badge className="shrink-0 whitespace-nowrap rounded border-red-500/20 bg-red-500/10 text-red-500">
            <XCircle className="mr-1 h-3 w-3" />
            Erro
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="shrink-0 whitespace-nowrap rounded">
            <Unlink className="mr-1 h-3 w-3" />
            Desconectado
          </Badge>
        )
    }
  }

  return (
    <div className="flex h-full min-w-0 flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center justify-between gap-3 border-b border-border bg-background px-8">
        <div className="flex flex-col">
          <h1 className="font-mono text-[13px] font-semibold tracking-tight text-foreground">whatsapp</h1>
          <p className="text-[10px] leading-none text-muted-foreground">canal · {activeInstance?.status === "connected" ? "conectado" : "sem instância"}</p>
        </div>
        {getStatusBadge()}
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-5 scrollbar-hide">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="min-w-0 rounded border border-border bg-card p-4">
            {activeInstance?.status === "connected" ? (
              <>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-mono text-[12px] font-semibold text-foreground">instância principal</h3>
                  <span className="flex w-fit items-center gap-1 rounded bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                    <CheckCircle2 className="h-2.5 w-2.5" /> conectado
                  </span>
                </div>
                <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Smartphone className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-[15px] font-medium">{activeInstance.phoneNumber ? `+${activeInstance.phoneNumber}` : "Número não disponível"}</p>
                    <p className="mt-1 break-words font-mono text-xs text-muted-foreground">
                      {activeInstance.profileName || "Perfil não identificado"}
                    </p>
                  </div>
                  <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => refreshStatus(activeInstance.id)} disabled={isLoading}>
                      <RefreshCw className={cn("mr-2 h-3.5 w-3.5", isLoading && "animate-spin")} />
                      Atualizar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
                      onClick={() => deleteInstance(activeInstance)}
                      disabled={deletingInstanceId === activeInstance.id}
                    >
                      {deletingInstanceId === activeInstance.id ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Trash2 className="mr-2 h-3.5 w-3.5" />}
                      Remover
                    </Button>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    ["Criada em", formatDate(activeInstance.createdAt)],
                    ["Última sync", activeInstance.lastSyncedAt ? formatDate(activeInstance.lastSyncedAt) : "pendente"],
                    ["Status real", activeInstance.loggedIn ? "logado" : activeInstance.connected ? "conectado" : activeInstance.status],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded border border-border p-2">
                      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{label}</p>
                      <p className="mt-1 font-mono text-sm font-medium">{value}</p>
                    </div>
                  ))}
                </div>
                {activeInstance.lastError && (
                  <Alert variant="destructive" className="mt-4">
                    <XCircle className="h-4 w-4" />
                    <AlertDescription>{activeInstance.lastError}</AlertDescription>
                  </Alert>
                )}
              </>
            ) : (
              <div className="py-6">
                <h3 className="font-display text-lg font-bold">Conectar WhatsApp</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {step === "name" ? "Dê um nome para identificar este número na plataforma." : "Gerando QR Code..."}
                </p>
                {step === "name" && (
                  <div className="mt-6 max-w-sm space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="connection-name" className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                        Nome da instância
                      </Label>
                      <Input
                        id="connection-name"
                        placeholder="Ex.: Loja Principal"
                        value={connectionName}
                        onChange={(event) => setConnectionName(event.target.value)}
                        onKeyDown={(event) => event.key === "Enter" && handleSaveName()}
                      />
                    </div>
                    <Button className="w-full" onClick={handleSaveName} disabled={!connectionName.trim()}>
                      Continuar <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right card: QR code / new instance */}
          <div className="min-w-0 rounded border border-border bg-card p-4 sm:p-6">
            <h3 className="font-display text-lg font-bold">Adicionar nova instância</h3>
            <p className="mt-1 mb-5 text-xs text-muted-foreground">Escaneie o QR com o WhatsApp do aparelho</p>

            {error && (
              <Alert variant="destructive" className="mb-4">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="flex flex-col items-center rounded bg-muted p-4 sm:p-6">
              {qrCode ? (
                <>
                  <div className="rounded border border-border bg-card p-4">
                    <SafeImage
                      src={qrCode}
                      alt="QR Code WhatsApp"
                      className="h-48 w-48 sm:h-56 sm:w-56"
                      fallbackLabel="QR indisponível"
                      fallbackHint="Gere um novo QR Code."
                    />
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <span className="flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-500">
                      <RefreshCw className="h-3 w-3 animate-spin" /> Aguardando leitura
                    </span>
                  </div>
                  <div className="mt-4 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={generateQRCode} disabled={isLoading}>
                      <RefreshCw className={cn("mr-2 h-3.5 w-3.5", isLoading && "animate-spin")} /> Atualizar QR
                    </Button>
                    <Button size="sm" className="w-full sm:w-auto" onClick={() => refreshStatus()} disabled={isLoading}>
                      <CheckCircle2 className="mr-2 h-3.5 w-3.5" /> Verificar
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  {step === "name" && instances.length > 0 ? (
                    <div className="w-full max-w-sm space-y-4">
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-background mx-auto">
                        <QrCode className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <div className="space-y-2 text-left">
                        <Label htmlFor="new-connection-name" className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
                          Nome da nova instância
                        </Label>
                        <Input
                          id="new-connection-name"
                          placeholder="Ex.: Loja 2"
                          value={connectionName}
                          onChange={(event) => setConnectionName(event.target.value)}
                          onKeyDown={(event) => event.key === "Enter" && handleSaveName()}
                        />
                      </div>
                      <Button className="w-full" onClick={handleSaveName} disabled={!connectionName.trim()}>
                        Continuar <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-background">
                        <QrCode className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <p className="mt-4 text-center text-sm text-muted-foreground">
                        {savedName ? "Clique abaixo para gerar o QR Code da nova instância" : "Informe o nome da instância primeiro"}
                      </p>
                      <Button className="mt-4 w-full sm:w-auto" onClick={generateQRCode} disabled={isLoading || !savedName}>
                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <QrCode className="mr-2 h-4 w-4" />}
                        Gerar QR Code
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>

            {savedName && (
              <div className="mt-4">
                <Label className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">Nome da conexão</Label>
                <p className="mt-1 text-sm font-medium">{savedName}</p>
              </div>
            )}
          </div>

          {/* Instances list below (full width) */}
          {instances.length > 0 && (
            <div className="rounded border border-border bg-card p-4 sm:p-5 xl:col-span-2">
              <h3 className="mb-3 font-display text-base font-bold">Instâncias do tenant</h3>
              <div className="space-y-2">
                {instances.map((instance) => (
                  <div key={instance.id} className={cn(
                    "flex items-start gap-3 rounded-lg border p-3 transition-colors sm:items-center",
                    activeInstanceId === instance.id ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"
                  )}>
                    <button type="button" onClick={() => selectInstance(instance)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                      <InstanceStatusIcon status={instance.status} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{instance.name}</p>
                        <p className="break-words text-xs text-muted-foreground">
                          {instance.phoneNumber ? `+${instance.phoneNumber}` : formatDate(instance.updatedAt)}
                        </p>
                      </div>
                    </button>
                    <Button variant="ghost" size="icon" onClick={() => deleteInstance(instance)} disabled={deletingInstanceId === instance.id} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                      {deletingInstanceId === instance.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function InstanceStatusIcon({ status }: { status: ConnectionStatus }) {
  if (status === "connected") {
    return <CheckCircle2 className="h-4 w-4 text-primary" />
  }

  if (status === "connecting") {
    return <RefreshCw className="h-4 w-4 animate-spin text-amber-500" />
  }

  if (status === "error") {
    return <XCircle className="h-4 w-4 text-destructive" />
  }

  return <Unlink className="h-4 w-4 text-muted-foreground" />
}
