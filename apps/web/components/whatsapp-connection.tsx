"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import {
  Smartphone,
  QrCode,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Unlink,
  Loader2,
  MessageCircle,
  ArrowRight,
} from "lucide-react"

type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error"
type Step = "name" | "qrcode"

interface QRCodeData {
  qrcode: string
  expiresAt: number
}

export function WhatsAppConnection() {
  const [step, setStep] = useState<Step>("name")
  const [status, setStatus] = useState<ConnectionStatus>("disconnected")
  const [qrCode, setQrCode] = useState<QRCodeData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [connectionName, setConnectionName] = useState("")
  const [savedName, setSavedName] = useState("")

  const handleSaveName = () => {
    if (!connectionName.trim()) return
    setSavedName(connectionName.trim())
    setStep("qrcode")
  }

  const generateQRCode = async () => {
    setIsLoading(true)
    setError(null)
    setStatus("connecting")

    try {
      await new Promise(resolve => setTimeout(resolve, 2000))
      setQrCode({
        qrcode: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEAAQMAAABmvDolAAAABlBMVEX///8AAABVwtN+AAABeklEQVR42uyYsY3DMAxF/+0CWkJLeAkv4SW8hJfQElrCO6jgQYpEKYlT3CFFwlOT94EiKepjPtgK/icLsL6t5R3A+raWdwDr21reAaxva3n/BoDfXd4B6C8AWK/WslwB8LvLOwD9BQDr1VqWKwB+d3kHoL8AYL1ay3IFwO8u7wD0FwCsV2tZrgD43eUdgP4CgPVqLcsVAL+7vAPQXwCwXq1luQLgd5d3APoLANartSxXAPzu8g5AfwHAerWW5QqA313eAegvAFiv1rJcAfC7yzsA/QUA69ValitAfgfA7y7vAPQXAKxXa1muAPjd5R2A/gKA9WotyxUAv7u8A9BfALBerWW5AuB3l3cA+gsA1qu1LFcA/O7yDkB/AcB6tZblCoDfXd4B6C8AWK/WslwB8LvLOwD9BQDr1VqWKwB+d3kHoL8AYL1ay3IFwO8u7wD0FwCsV2tZrgD43eUdgP4CgPVqLcsVAL+7vAPQXwCwXq1luQLgd5d3APrLF/gBYLEsC8T+5HEAAAAASUVORK5CYII=",
        expiresAt: Date.now() + 60000,
      })
    } catch {
      setError("Erro ao gerar QR Code. Tente novamente.")
      setStatus("error")
    } finally {
      setIsLoading(false)
    }
  }

  const simulateConnection = async () => {
    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 2000))
    setStatus("connected")
    setPhoneNumber("+55 11 98765-4321")
    setQrCode(null)
    setIsLoading(false)
  }

  const disconnect = async () => {
    setIsLoading(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setStatus("disconnected")
    setPhoneNumber(null)
    setQrCode(null)
    setConnectionName("")
    setSavedName("")
    setStep("name")
    setIsLoading(false)
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
      {/* Header */}
      <div className="relative z-10 flex items-center justify-between border-b border-border pl-6 pr-10 py-4 bg-background">
        <div>
          <h1 className="text-xl font-bold text-foreground font-display">WhatsApp</h1>
          <p className="text-sm text-muted-foreground font-sans">
            Conecte seu WhatsApp para atender seus clientes
          </p>
        </div>
        {getStatusBadge()}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-8 scrollbar-hide">
        <div className="max-w-2xl mx-auto space-y-6 text-center lg:text-left">
          <Card className="rounded-[5px] border-border shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 pb-8">
              <CardTitle className="flex items-center gap-2 font-display text-lg">
                <MessageCircle className="h-5 w-5 text-primary" />
                Conectar WhatsApp
              </CardTitle>
              <CardDescription className="font-sans">
                {status === "connected"
                  ? "Seu WhatsApp está conectado e pronto para uso."
                  : step === "name"
                  ? "Dê um nome para identificar esta conexão antes de continuar."
                  : "Escaneie o QR Code com seu celular para vincular sua conta."}
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-8">
              {error && (
                <Alert variant="destructive" className="mb-6 rounded-[5px]">
                  <XCircle className="h-4 w-4" />
                  <AlertDescription className="font-sans">{error}</AlertDescription>
                </Alert>
              )}

              {/* Etapa 1: Nome da conexão */}
              {status !== "connected" && step === "name" && (
                <div className="py-6 space-y-6 max-w-sm mx-auto">
                  <div className="text-center space-y-2">
                    <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                      <Smartphone className="h-8 w-8 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground font-sans">
                      Este nome ajuda a identificar a conexão na plataforma.
                      <br/>Ex.: <span className="font-medium text-foreground">Loja Centro</span> ou <span className="font-medium text-foreground">Vendas</span>.
                    </p>
                  </div>
                  <div className="space-y-2 text-left">
                    <Label htmlFor="connection-name" className="font-sans font-bold text-xs uppercase tracking-widest text-muted-foreground">Nome da conexão</Label>
                    <Input
                      id="connection-name"
                      placeholder="Ex.: Loja Principal"
                      value={connectionName}
                      onChange={(e) => setConnectionName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
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

              {/* Etapa 2: QR Code */}
              {status !== "connected" && step === "qrcode" && (
                <div className="text-center py-6 space-y-8">
                  {savedName && (
                    <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-xs font-bold text-primary uppercase tracking-wider">
                      <Smartphone className="h-3.5 w-3.5" />
                      <span>{savedName}</span>
                    </div>
                  )}

                  {qrCode ? (
                    <>
                      <div className="inline-block p-6 bg-white rounded-[5px] border border-border/50 shadow-lg">
                        <img
                          src={qrCode.qrcode}
                          alt="QR Code WhatsApp"
                          className="w-64 h-64 mx-auto"
                        />
                      </div>

                      <div className="space-y-4">
                        <p className="font-bold text-foreground font-display">Como conectar:</p>
                        <ol className="text-sm text-muted-foreground space-y-2 max-w-sm mx-auto text-left list-decimal list-inside font-sans">
                          <li>Abra o <span className="text-foreground font-medium">WhatsApp</span> no seu celular</li>
                          <li>Toque em <span className="text-foreground font-medium">Menu</span> ou <span className="text-foreground font-medium">Configurações</span></li>
                          <li>Selecione <span className="text-foreground font-medium">Aparelhos conectados</span></li>
                          <li>Toque em <span className="text-foreground font-medium">Conectar um aparelho</span></li>
                          <li>Aponte a câmera para este QR Code</li>
                        </ol>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-center gap-3 pt-4">
                        <Button variant="outline" onClick={generateQRCode} disabled={isLoading} className="rounded-[5px] font-sans shadow-none">
                          <RefreshCw className={cn("mr-2 h-4 w-4", isLoading && "animate-spin")} />
                          Atualizar QR Code
                        </Button>
                        <Button onClick={simulateConnection} disabled={isLoading} className="rounded-[5px] font-sans shadow-none">
                          {isLoading ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                          )}
                          Simular Conexão
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="space-y-6">
                      <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                        <QrCode className="h-10 w-10 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-xl font-bold text-foreground font-display">Pronto para conectar</p>
                        <p className="text-muted-foreground mt-1 text-sm font-sans">
                          Clique no botão abaixo para gerar o QR Code de vinculação
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
                          Alterar nome da conexão
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Conectado */}
              {status === "connected" && (
                <div className="text-center py-10 space-y-6">
                  <div className="relative inline-flex h-24 w-24 items-center justify-center rounded-full bg-primary/10">
                    <CheckCircle2 className="h-12 w-12 text-primary" />
                    <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin-slow" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-foreground font-display">WhatsApp Conectado</h2>
                    {savedName && (
                      <p className="text-sm font-bold text-primary mt-1 uppercase tracking-widest">{savedName}</p>
                    )}
                    {phoneNumber && (
                      <p className="text-muted-foreground font-mono mt-2">{phoneNumber}</p>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground max-w-sm mx-auto font-sans leading-relaxed">
                    Seu WhatsApp está pronto para receber e enviar mensagens.
                    As conversas aparecerão automaticamente na sua <span className="text-foreground font-medium">Caixa de Entrada</span>.
                  </p>
                  <Button variant="destructive" onClick={disconnect} disabled={isLoading} className="mt-6 rounded-[5px] shadow-none">
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Unlink className="mr-2 h-4 w-4" />
                    )}
                    Desconectar Aparelho
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {status === "connected" && (
            <Alert className="bg-primary/10 border-primary/20 rounded-[5px]">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <AlertTitle className="text-primary font-bold font-display">Conexão Ativa</AlertTitle>
              <AlertDescription className="text-primary/80 font-sans text-xs">
                Seu WhatsApp está operando normalmente. Mantenha seu celular conectado à internet para evitar interrupções no atendimento automático.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </div>
    </div>
  )
}
