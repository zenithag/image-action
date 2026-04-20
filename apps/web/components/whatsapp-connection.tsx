"use client"

import { useEffect, useMemo, useState } from "react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Loader2,
  MessageCircle,
  QrCode,
  RefreshCw,
  Server,
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
  const [isLoadingInstances, setIsLoadingInstances] = useState(true)
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
  const qrCode = activeInstance?.qrcode

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
          setActiveInstanceId(preferredInstance.id)
          setSavedName(preferredInstance.name)
          setStep("qrcode")
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

    setIsLoading(true)
    setError(null)

    try {
      const response = activeInstance
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
      setActiveInstanceId(instance.id)
      setSavedName(instance.name)
      setStep("qrcode")

      if (!instance.qrcode && !instance.connected && !instance.paircode) {
        setError("Instancia criada, mas a UAZAPI ainda nao retornou QR Code. Clique em Atualizar QR Code.")
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
      setActiveInstanceId(instance.id)
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

  const deleteInstance = async (instance: TenantWhatsappInstance) => {
    if (deletingInstanceId) return

    const shouldDelete = window.confirm(`Remover a instancia "${instance.name}" deste tenant? O sistema tambem tentara deletar a instancia na UAZAPI.`)
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
          setActiveInstanceId(nextActiveInstance.id)
          setSavedName(nextActiveInstance.name)
          setStep("qrcode")
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
          <Badge className="bg-primary/10 text-primary border-primary/20 rounded-[5px]">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Conectado
          </Badge>
        )
      case "connecting":
        return (
          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20 rounded-[5px]">
            <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
            Aguardando leitura
          </Badge>
        )
      case "error":
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20 rounded-[5px]">
            <XCircle className="mr-1 h-3 w-3" />
            Erro
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary" className="rounded-[5px]">
            <Unlink className="mr-1 h-3 w-3" />
            Desconectado
          </Badge>
        )
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="relative z-10 flex items-center justify-between border-b border-border pl-6 pr-10 py-4 bg-background">
        <div>
          <h1 className="text-xl font-bold text-foreground font-display">WhatsApp</h1>
          <p className="text-sm text-muted-foreground font-sans">
            Crie a instancia no UAZAPI, gere o QR Code e conecte o WhatsApp do tenant.
          </p>
        </div>
        {getStatusBadge()}
      </div>

      <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_360px]">
          <Card className="rounded-[5px] border-border shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 pb-8">
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <MessageCircle className="h-5 w-5 text-primary" />
                Conectar WhatsApp
              </CardTitle>
              <CardDescription className="font-sans">
                {status === "connected"
                  ? "Seu WhatsApp esta conectado e pronto para uso."
                  : step === "name"
                    ? "Dê um nome para a instancia que sera criada na UAZAPI."
                    : "Gere o QR Code e escaneie no WhatsApp para concluir a conexao."}
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-8">
              {error && (
                <Alert variant="destructive" className="mb-6 rounded-[5px]">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription className="font-sans">{error}</AlertDescription>
                </Alert>
              )}

              {status !== "connected" && step === "name" && (
                <div className="py-6 space-y-6 max-w-sm mx-auto">
                  <div className="text-center space-y-2">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                      <Smartphone className="h-8 w-8 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground font-sans">
                      Esse nome sera enviado para o UAZAPI como nome da instancia.
                      <br />Ex.: <span className="font-medium text-foreground">Loja Centro</span> ou{" "}
                      <span className="font-medium text-foreground">Vendas</span>.
                    </p>
                  </div>
                  <div className="space-y-2 text-left">
                    <Label htmlFor="connection-name" className="font-sans font-bold text-xs uppercase tracking-widest text-muted-foreground">
                      Nome da instancia
                    </Label>
                    <Input
                      id="connection-name"
                      placeholder="Ex.: Loja Principal"
                      value={connectionName}
                      onChange={(event) => setConnectionName(event.target.value)}
                      onKeyDown={(event) => event.key === "Enter" && handleSaveName()}
                      className="rounded-[5px] border-input focus:ring-primary font-sans"
                    />
                  </div>
                  <Button
                    className="w-full font-sans rounded-[5px] shadow-none"
                    onClick={handleSaveName}
                    disabled={!connectionName.trim()}
                  >
                    Continuar
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              )}

              {status !== "connected" && step === "qrcode" && (
                <div className="text-center py-6 space-y-8">
                  {savedName && (
                    <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary uppercase tracking-wider">
                      <Smartphone className="h-3.5 w-3.5" />
                      <span>{savedName}</span>
                    </div>
                  )}

                  {activeInstance?.providerName && (
                    <div className="mx-auto flex max-w-sm items-center justify-center gap-2 rounded-[5px] border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                      <Server className="h-3.5 w-3.5" />
                      Provider alocado automaticamente: <span className="font-bold text-foreground">{activeInstance.providerName}</span>
                    </div>
                  )}

                  {qrCode ? (
                    <>
                      <div className="inline-block p-6 bg-white rounded-[5px] border border-border/50 shadow-lg">
                        <img
                          src={qrCode}
                          alt="QR Code WhatsApp"
                          className="w-64 h-64 mx-auto"
                        />
                      </div>

                      <div className="space-y-4">
                        <p className="font-bold text-foreground font-display">Como conectar:</p>
                        <ol className="text-sm text-muted-foreground space-y-2 max-w-sm mx-auto text-left list-decimal list-inside font-sans">
                          <li>Abra o <span className="text-foreground font-medium">WhatsApp</span> no celular</li>
                          <li>Toque em <span className="text-foreground font-medium">Menu</span> ou <span className="text-foreground font-medium">Configurações</span></li>
                          <li>Selecione <span className="text-foreground font-medium">Aparelhos conectados</span></li>
                          <li>Toque em <span className="text-foreground font-medium">Conectar um aparelho</span></li>
                          <li>Aponte a camera para este QR Code</li>
                        </ol>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
                        <Button variant="outline" onClick={generateQRCode} disabled={isLoading} className="rounded-[5px] font-sans shadow-none">
                          <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                          Atualizar QR Code
                        </Button>
                        <Button onClick={() => refreshStatus()} disabled={isLoading} className="rounded-[5px] font-sans shadow-none">
                          {isLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                          )}
                          Verificar status
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-6">
                      <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                        <QrCode className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xl font-bold text-foreground font-display">Pronto para gerar QR Code</p>
                        <p className="text-muted-foreground mt-1 text-sm font-sans">
                          O sistema vai escolher automaticamente o UAZAPI com menos instancias em uso.
                        </p>
                      </div>
                      <Button onClick={generateQRCode} disabled={isLoading} size="lg" className="rounded-[5px] font-sans shadow-none">
                        {isLoading ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <QrCode className="mr-2 h-4 w-4" />
                        )}
                        Gerar QR Code
                      </Button>
                      <div>
                        <button
                          className="text-xs text-muted-foreground underline-offset-4 hover:underline font-sans"
                          onClick={() => setStep("name")}
                        >
                          Alterar nome da instancia
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {status === "connected" && (
                <div className="text-center py-10 space-y-6">
                  <div className="relative inline-flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
                    <CheckCircle2 className="h-12 w-12 text-primary" />
                    <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin-slow" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground font-display">WhatsApp Conectado</h2>
                    {activeInstance?.name && (
                      <p className="text-sm font-bold text-primary mt-1 uppercase tracking-widest">{activeInstance.name}</p>
                    )}
                    {activeInstance?.phoneNumber && (
                      <p className="text-muted-foreground font-mono mt-2">+{activeInstance.phoneNumber}</p>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto font-sans leading-relaxed">
                    As conversas desta instancia entram na caixa de entrada do tenant.
                  </p>
                  <div className="flex flex-col justify-center gap-3 sm:flex-row">
                    <Button onClick={() => refreshStatus()} disabled={isLoading} className="rounded-[5px] font-sans shadow-none">
                      {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                      Atualizar status
                    </Button>
                    <Button variant="outline" onClick={startNewConnection} className="rounded-[5px] font-sans shadow-none">
                      Nova instancia
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <aside className="space-y-4">
            <Card className="rounded-[5px] border-border shadow-sm">
              <CardHeader>
                <CardTitle className="font-display text-base">Instancias do tenant</CardTitle>
                <CardDescription>
                  Criadas a partir deste tenant. Tokens ficam armazenados somente no servidor.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoadingInstances ? (
                  <div className="flex items-center gap-2 rounded-[5px] border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Carregando conexoes...
                  </div>
                ) : instances.length > 0 ? (
                  instances.map((instance) => (
                    <div
                      key={instance.id}
                      className={cn(
                        "w-full rounded-[5px] border p-3 text-left transition-colors",
                        activeInstanceId === instance.id
                          ? "border-primary bg-primary/5"
                          : "border-border bg-card hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveInstanceId(instance.id)
                            setSavedName(instance.name)
                            setStep("qrcode")
                            setError(null)
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <p className="truncate font-bold text-foreground font-display">{instance.name}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">{instance.providerName}</p>
                        </button>
                        <div className="flex items-center gap-2">
                          <InstanceStatusIcon status={instance.status} />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => deleteInstance(instance)}
                            disabled={deletingInstanceId === instance.id}
                            className="h-8 w-8 rounded-[5px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Remover instancia ${instance.name}`}
                          >
                            {deletingInstanceId === instance.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <Clock3 className="h-3 w-3" />
                        Atualizada em {formatDate(instance.updatedAt)}
                      </p>
                      {instance.lastError && (
                        <p className="mt-2 text-xs text-destructive">{instance.lastError}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="rounded-[5px] border border-dashed border-border p-5 text-center">
                    <p className="text-sm font-bold text-foreground">Nenhuma instancia criada</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Informe um nome e gere o primeiro QR Code.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Alert className="rounded-[5px] border-primary/20 bg-primary/10">
              <Server className="h-4 w-4 text-primary" />
              <AlertTitle className="font-display text-primary">Alocacao automatica</AlertTitle>
              <AlertDescription className="text-xs text-primary/80">
                Ao criar uma instancia, o sistema usa primeiro o provider WhatsApp com menos instancias em uso e capacidade disponivel.
              </AlertDescription>
            </Alert>
          </aside>
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
