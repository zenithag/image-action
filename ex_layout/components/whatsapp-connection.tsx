"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
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
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Conectado
          </Badge>
        )
      case "connecting":
        return (
          <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">
            <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
            Aguardando leitura
          </Badge>
        )
      case "error":
        return (
          <Badge className="bg-red-500/10 text-red-500 border-red-500/20">
            <XCircle className="mr-1 h-3 w-3" />
            Erro
          </Badge>
        )
      default:
        return (
          <Badge variant="secondary">
            <Unlink className="mr-1 h-3 w-3" />
            Desconectado
          </Badge>
        )
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">WhatsApp</h1>
          <p className="text-muted-foreground mt-1">
            Conecte seu WhatsApp para atender seus clientes
          </p>
        </div>
        {getStatusBadge()}
      </div>

      {/* Main Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-500" />
            Conectar WhatsApp
          </CardTitle>
          <CardDescription>
            {status === "connected"
              ? "Seu WhatsApp está conectado e pronto para uso."
              : step === "name"
              ? "Dê um nome para identificar esta conexão antes de continuar."
              : "Escaneie o QR Code com seu celular para vincular sua conta."}
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Etapa 1: Nome da conexão */}
          {status !== "connected" && step === "name" && (
            <div className="py-6 space-y-6 max-w-sm mx-auto">
              <div className="text-center space-y-2">
                <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                  <Smartphone className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Este nome ajuda a identificar a conexão na plataforma.
                  Por exemplo: <span className="font-medium text-foreground">Loja Centro</span> ou <span className="font-medium text-foreground">Atendimento Vendas</span>.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="connection-name">Nome da conexão</Label>
                <Input
                  id="connection-name"
                  placeholder="Ex.: Loja Centro"
                  value={connectionName}
                  onChange={(e) => setConnectionName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveName()}
                />
              </div>
              <Button
                className="w-full"
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
            <div className="text-center py-6 space-y-6">
              {savedName && (
                <div className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-1.5 text-sm text-muted-foreground">
                  <Smartphone className="h-3.5 w-3.5" />
                  <span className="font-medium text-foreground">{savedName}</span>
                </div>
              )}

              {qrCode ? (
                <>
                  <div className="inline-block p-4 bg-white rounded-xl shadow-sm">
                    <img
                      src={qrCode.qrcode}
                      alt="QR Code WhatsApp"
                      className="w-64 h-64"
                    />
                  </div>

                  <div className="space-y-2">
                    <p className="font-medium text-foreground">Como conectar:</p>
                    <ol className="text-sm text-muted-foreground space-y-1 max-w-sm mx-auto text-left list-decimal list-inside">
                      <li>Abra o WhatsApp no seu celular</li>
                      <li>Toque em <span className="font-medium text-foreground">Menu</span> ou <span className="font-medium text-foreground">Configuracoes</span></li>
                      <li>Selecione <span className="font-medium text-foreground">Aparelhos conectados</span></li>
                      <li>Toque em <span className="font-medium text-foreground">Conectar um aparelho</span></li>
                      <li>Aponte a camera para este QR Code</li>
                    </ol>
                  </div>

                  <div className="flex justify-center gap-2 pt-2">
                    <Button variant="outline" onClick={generateQRCode} disabled={isLoading}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Atualizar QR Code
                    </Button>
                    <Button onClick={simulateConnection} disabled={isLoading}>
                      {isLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}
                      Simular Conexao
                    </Button>
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                    <QrCode className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xl font-medium text-foreground">Pronto para conectar</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Clique no botao abaixo para gerar o QR Code
                    </p>
                  </div>
                  <Button onClick={generateQRCode} disabled={isLoading} size="lg">
                    {isLoading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <QrCode className="mr-2 h-4 w-4" />
                    )}
                    Gerar QR Code
                  </Button>
                  <div>
                    <button
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                      onClick={() => setStep("name")}
                    >
                      Alterar nome da conexao
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Conectado */}
          {status === "connected" && (
            <div className="text-center py-8 space-y-4">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500/10">
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              </div>
              <div>
                <p className="text-xl font-medium text-foreground">WhatsApp Conectado</p>
                {savedName && (
                  <p className="text-sm font-medium text-muted-foreground mt-0.5">{savedName}</p>
                )}
                {phoneNumber && (
                  <p className="text-muted-foreground mt-1">{phoneNumber}</p>
                )}
              </div>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Seu WhatsApp esta pronto para receber e enviar mensagens.
                As conversas aparecerão automaticamente na sua caixa de entrada.
              </p>
              <Button variant="destructive" onClick={disconnect} disabled={isLoading} className="mt-4">
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Unlink className="mr-2 h-4 w-4" />
                )}
                Desconectar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {status === "connected" && (
        <Alert className="bg-emerald-500/10 border-emerald-500/20">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <AlertTitle className="text-emerald-500">Conexao Ativa</AlertTitle>
          <AlertDescription className="text-emerald-500/80">
            Seu WhatsApp esta conectado e pronto para enviar e receber mensagens.
            Mantenha seu celular conectado a internet para manter a conexao ativa.
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
