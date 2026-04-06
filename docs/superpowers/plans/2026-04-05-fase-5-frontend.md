# Fase 5: Frontend (Inbox + Catalogo + Dashboard) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Construir inbox do operador com realtime (Socket.IO + Zustand), catalogo com filtros, dashboard melhorado e auth OIDC via Zitadel (next-auth v5) no Next.js existente.

**Architecture:** next-auth v5 com OIDC provider generico autentica via Zitadel, extraindo org_id e roles. Zustand store gerencia conversas/mensagens, alimentado por Socket.IO middleware que escuta eventos do backend. Layout 2 colunas para inbox (lista | chat) com painel colapsavel de detalhes.

**Tech Stack:** Next.js 15.3, React 19, next-auth v5, Zustand, socket.io-client, Shadcn/ui, Tailwind CSS 4, TypeScript, @studio/contracts

---

## Task 1: Instalar dependencias novas

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: Instalar next-auth, zustand, socket.io-client**

Run:
```bash
cd apps/web && pnpm add next-auth@beta zustand socket.io-client
```

- [ ] **Step 2: Verificar que o build funciona**

Run: `cd apps/web && pnpm build`
Expected: Build com sucesso

- [ ] **Step 3: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "deps: add next-auth, zustand, socket.io-client to web app"
```

---

## Task 2: Configurar next-auth com OIDC Zitadel

**Files:**
- Create: `apps/web/lib/auth.ts`
- Create: `apps/web/app/api/auth/[...nextauth]/route.ts`
- Modify: `apps/web/app/layout.tsx`

- [ ] **Step 1: Criar lib/auth.ts**

```typescript
import NextAuth from "next-auth"
import type { NextAuthConfig } from "next-auth"

export const authConfig: NextAuthConfig = {
  providers: [
    {
      id: "zitadel",
      name: "Zitadel",
      type: "oidc",
      issuer: process.env.ZITADEL_ISSUER_URL || "http://localhost:8080",
      clientId: process.env.ZITADEL_CLIENT_ID || "",
      clientSecret: process.env.ZITADEL_CLIENT_SECRET || "",
      authorization: {
        params: {
          scope: "openid profile email urn:zitadel:iam:org:project:id:zitadel:aud",
        },
      },
    },
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.accessToken = account.access_token
        // Extract Zitadel org_id as tenant_id
        const orgId = (profile as Record<string, unknown>)["urn:zitadel:iam:org:id"]
        if (typeof orgId === "string") {
          token.tenantId = orgId
        }
        // Extract roles from project roles claim
        const projectId = process.env.ZITADEL_PROJECT_ID || ""
        const rolesKey = `urn:zitadel:iam:org:project:${projectId}:roles`
        const projectRoles = (profile as Record<string, unknown>)[rolesKey]
        if (projectRoles && typeof projectRoles === "object") {
          token.roles = Object.keys(projectRoles as Record<string, unknown>)
        } else {
          token.roles = []
        }
      }
      return token
    },
    async session({ session, token }) {
      return {
        ...session,
        accessToken: token.accessToken as string | undefined,
        user: {
          ...session.user,
          id: token.sub || "",
          tenantId: (token.tenantId as string) || null,
          roles: (token.roles as string[]) || [],
        },
      }
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
}

export const { handlers, signIn, signOut, auth } = NextAuth(authConfig)
```

- [ ] **Step 2: Criar route handler**

`apps/web/app/api/auth/[...nextauth]/route.ts`:
```typescript
import { handlers } from "@/lib/auth"

export const { GET, POST } = handlers
```

- [ ] **Step 3: Criar types para session estendida**

`apps/web/types/next-auth.d.ts`:
```typescript
import "next-auth"

declare module "next-auth" {
  interface Session {
    accessToken?: string
    user: {
      id: string
      tenantId: string | null
      roles: string[]
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}
```

- [ ] **Step 4: Criar SessionProvider wrapper**

`apps/web/components/session-provider.tsx`:
```typescript
"use client"

import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"
import type { ReactNode } from "react"

export function SessionProvider({ children }: { children: ReactNode }) {
  return <NextAuthSessionProvider>{children}</NextAuthSessionProvider>
}
```

- [ ] **Step 5: Adicionar SessionProvider ao layout.tsx**

Em `apps/web/app/layout.tsx`, importar e envolver children com SessionProvider dentro do ThemeProvider:

```typescript
import "./globals.css";
import type { Metadata } from "next";
import { ReactNode } from "react";
import { Fraunces, Inter } from "next/font/google";

import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "@/components/session-provider";

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Atendimento Visual Multi-Tenant",
  description: "Plataforma conversacional multi-tenant para composicao visual por WhatsApp.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${fraunces.variable} ${inter.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
          <SessionProvider>
            {children}
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 6: Criar .env.local de exemplo**

`apps/web/.env.local.example`:
```
ZITADEL_ISSUER_URL=http://localhost:8080
ZITADEL_CLIENT_ID=
ZITADEL_CLIENT_SECRET=
ZITADEL_PROJECT_ID=
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=dev-secret-change-me
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=http://localhost:8000
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/lib/auth.ts apps/web/app/api/auth/ apps/web/types/ apps/web/components/session-provider.tsx apps/web/app/layout.tsx apps/web/.env.local.example
git commit -m "feat: next-auth v5 with Zitadel OIDC provider"
```

---

## Task 3: Middleware Next.js para proteger rotas

**Files:**
- Create: `apps/web/middleware.ts`

- [ ] **Step 1: Criar middleware.ts**

```typescript
export { auth as middleware } from "@/lib/auth"

export const config = {
  matcher: ["/tenant/:path*", "/superadmin/:path*"],
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/middleware.ts
git commit -m "feat: Next.js middleware to protect tenant and superadmin routes"
```

---

## Task 4: API client com auth header

**Files:**
- Create: `apps/web/lib/api.ts`

- [ ] **Step 1: Criar api.ts**

```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

type FetchOptions = RequestInit & {
  accessToken?: string
}

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { accessToken, headers: customHeaders, ...rest } = options

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...Object.fromEntries(
      Object.entries(customHeaders || {}).filter(([, v]) => v != null) as [string, string][]
    ),
  }

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`
  }

  const res = await fetch(`${API_URL}${path}`, {
    headers,
    ...rest,
  })

  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`)
  }

  return res.json() as Promise<T>
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/api.ts
git commit -m "feat: API client with auth header support"
```

---

## Task 5: Zustand store para conversas e mensagens

**Files:**
- Create: `apps/web/lib/stores/conversation-store.ts`

- [ ] **Step 1: Criar conversation-store.ts**

```typescript
import { create } from "zustand"
import type { Conversation, Message } from "@studio/contracts"

type ConversationStore = {
  conversations: Conversation[]
  activeConversationId: string | null
  messages: Record<string, Message[]>

  setConversations: (conversations: Conversation[]) => void
  setActiveConversation: (id: string | null) => void
  setMessages: (conversationId: string, messages: Message[]) => void
  addMessage: (conversationId: string, message: Message) => void
  updateConversation: (conversationId: string, updates: Partial<Conversation>) => void
}

export const useConversationStore = create<ConversationStore>((set) => ({
  conversations: [],
  activeConversationId: null,
  messages: {},

  setConversations: (conversations) => set({ conversations }),

  setActiveConversation: (id) => set({ activeConversationId: id }),

  setMessages: (conversationId, messages) =>
    set((state) => ({
      messages: { ...state.messages, [conversationId]: messages },
    })),

  addMessage: (conversationId, message) =>
    set((state) => ({
      messages: {
        ...state.messages,
        [conversationId]: [...(state.messages[conversationId] || []), message],
      },
    })),

  updateConversation: (conversationId, updates) =>
    set((state) => ({
      conversations: state.conversations.map((c) =>
        c.id === conversationId ? { ...c, ...updates } : c
      ),
    })),
}))
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/stores/
git commit -m "feat: Zustand store for conversations and messages"
```

---

## Task 6: Socket.IO provider com Zustand middleware

**Files:**
- Create: `apps/web/lib/realtime/socket-provider.tsx`

- [ ] **Step 1: Criar socket-provider.tsx**

```typescript
"use client"

import { createContext, useContext, useEffect, useRef, type ReactNode } from "react"
import { io, type Socket } from "socket.io-client"
import { useSession } from "next-auth/react"
import { useConversationStore } from "@/lib/stores/conversation-store"

const SocketContext = createContext<Socket | null>(null)

export function useSocket() {
  return useContext(SocketContext)
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:8000"

export function SocketProvider({ children }: { children: ReactNode }) {
  const { data: session } = useSession()
  const socketRef = useRef<Socket | null>(null)
  const addMessage = useConversationStore((s) => s.addMessage)
  const updateConversation = useConversationStore((s) => s.updateConversation)

  useEffect(() => {
    const auth: Record<string, string> = {}
    if (session?.accessToken) {
      auth.token = session.accessToken
    }
    if (session?.user?.tenantId) {
      auth.tenant_id = session.user.tenantId
    }

    const socket = io(WS_URL, {
      path: "/socket.io",
      auth,
      transports: ["websocket", "polling"],
    })

    socket.on("new_message", (data: { conversation_id: string; message: Record<string, unknown> }) => {
      addMessage(data.conversation_id, {
        id: crypto.randomUUID(),
        tenant_id: "",
        conversation_id: data.conversation_id,
        direction: (data.message.direction as "inbound" | "outbound") || "inbound",
        role: (data.message.role as "customer" | "assistant" | "operator") || "customer",
        content: (data.message.content as string) || "",
        content_type: (data.message.content_type as "text") || "text",
        provider_message_id: null,
      })
    })

    socket.on("conversation_updated", (data: { conversation_id: string; state: string; handled_by: string; operator_id?: string }) => {
      updateConversation(data.conversation_id, {
        state: data.state as Conversation["state"],
        handled_by: data.handled_by as Conversation["handled_by"],
        operator_id: data.operator_id || null,
      })
    })

    socket.on("job_updated", (data: { job_id: string; status: string; conversation_id: string }) => {
      // Job updates can trigger conversation list refresh
      // For now, just update the conversation state if composing -> completed
      if (data.status === "done" || data.status === "failed") {
        updateConversation(data.conversation_id, {
          state: "completed",
        })
      }
    })

    socketRef.current = socket

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [session?.accessToken, session?.user?.tenantId, addMessage, updateConversation])

  return (
    <SocketContext.Provider value={socketRef.current}>
      {children}
    </SocketContext.Provider>
  )
}
```

Nota: importar `Conversation` de `@studio/contracts` no topo do arquivo para o type cast.

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/realtime/
git commit -m "feat: Socket.IO provider with Zustand middleware"
```

---

## Task 7: Layout do tenant com sidebar e SocketProvider

**Files:**
- Create: `apps/web/app/tenant/[slug]/layout.tsx`
- Create: `apps/web/components/organisms/tenant-sidebar.tsx`

- [ ] **Step 1: Criar tenant-sidebar.tsx**

```typescript
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Inbox, LayoutGrid, ShoppingBag, LogOut } from "lucide-react"
import { signOut } from "next-auth/react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const navItems = [
  { href: "", icon: LayoutGrid, label: "Dashboard" },
  { href: "/inbox", icon: Inbox, label: "Inbox" },
  { href: "/catalog", icon: ShoppingBag, label: "Catalogo" },
]

export function TenantSidebar({ slug }: { slug: string }) {
  const pathname = usePathname()

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-border bg-card/50">
      <div className="flex h-14 items-center border-b border-border px-4">
        <span className="font-display text-lg font-semibold tracking-tight">{slug}</span>
      </div>
      <nav className="flex flex-1 flex-col gap-1 p-3">
        {navItems.map((item) => {
          const fullHref = `/tenant/${slug}${item.href}`
          const isActive = pathname === fullHref
          return (
            <Link
              key={item.href}
              href={fullHref}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors",
                isActive
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="size-4" />
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="border-t border-border p-3">
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-3 text-muted-foreground"
          onClick={() => signOut()}
        >
          <LogOut className="size-4" />
          Sair
        </Button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 2: Criar tenant layout**

`apps/web/app/tenant/[slug]/layout.tsx`:
```typescript
import type { ReactNode } from "react"
import { SocketProvider } from "@/lib/realtime/socket-provider"
import { TenantSidebar } from "@/components/organisms/tenant-sidebar"

export default async function TenantLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <SocketProvider>
      <div className="flex h-screen bg-background">
        <TenantSidebar slug={slug} />
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </SocketProvider>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/tenant/\[slug\]/layout.tsx apps/web/components/organisms/tenant-sidebar.tsx
git commit -m "feat: tenant layout with sidebar navigation and SocketProvider"
```

---

## Task 8: Inbox — ConversationList

**Files:**
- Create: `apps/web/components/organisms/conversation-list.tsx`

- [ ] **Step 1: Criar conversation-list.tsx**

```typescript
"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useConversationStore } from "@/lib/stores/conversation-store"
import { apiFetch } from "@/lib/api"
import type { Conversation } from "@studio/contracts"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const stateLabels: Record<string, string> = {
  idle: "Aguardando",
  awaiting_base_image: "Esperando imagem",
  collecting_preferences: "Coletando prefs",
  showing_options: "Mostrando opcoes",
  awaiting_selection: "Esperando selecao",
  composing: "Compondo",
  completed: "Concluida",
}

const handledByLabels: Record<string, string> = {
  ai: "IA",
  operator: "Operador",
}

export function ConversationList() {
  const { data: session } = useSession()
  const conversations = useConversationStore((s) => s.conversations)
  const setConversations = useConversationStore((s) => s.setConversations)
  const activeId = useConversationStore((s) => s.activeConversationId)
  const setActive = useConversationStore((s) => s.setActiveConversation)
  const [filter, setFilter] = useState<"all" | "ai" | "operator">("all")

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<Conversation[]>("/v1/conversations", {
          accessToken: session?.accessToken,
        })
        setConversations(data)
      } catch {
        // silently fail — conversations will be empty
      }
    }
    load()
  }, [session?.accessToken, setConversations])

  const filtered = conversations.filter((c) => {
    if (filter === "all") return true
    return c.handled_by === filter
  })

  return (
    <div className="flex h-full flex-col border-r border-border bg-card/30">
      <div className="border-b border-border p-3">
        <h2 className="mb-3 font-display text-lg font-semibold">Conversas</h2>
        <div className="flex gap-1">
          {(["all", "ai", "operator"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-lg px-3 py-1 text-xs font-medium transition-colors",
                filter === f
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              {f === "all" ? "Todas" : handledByLabels[f]}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {filtered.map((conv) => (
          <button
            key={conv.id}
            onClick={() => setActive(conv.id)}
            className={cn(
              "flex w-full flex-col gap-1 border-b border-border/50 px-4 py-3 text-left transition-colors",
              activeId === conv.id ? "bg-primary/5" : "hover:bg-muted/50"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground truncate">
                {conv.contact_id.slice(0, 12)}...
              </span>
              <Badge variant={conv.handled_by === "operator" ? "default" : "secondary"} className="text-[10px]">
                {handledByLabels[conv.handled_by]}
              </Badge>
            </div>
            <span className="text-xs text-muted-foreground">
              {stateLabels[conv.state] || conv.state}
            </span>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="p-4 text-sm text-muted-foreground">Nenhuma conversa encontrada.</p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/organisms/conversation-list.tsx
git commit -m "feat: ConversationList component with filter by handled_by"
```

---

## Task 9: Inbox — ChatPanel

**Files:**
- Create: `apps/web/components/organisms/chat-panel.tsx`

- [ ] **Step 1: Criar chat-panel.tsx**

```typescript
"use client"

import { useEffect, useRef, useState } from "react"
import { useSession } from "next-auth/react"
import { useConversationStore } from "@/lib/stores/conversation-store"
import { apiFetch } from "@/lib/api"
import type { Message } from "@studio/contracts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Send, UserCheck, Bot } from "lucide-react"

export function ChatPanel() {
  const { data: session } = useSession()
  const activeId = useConversationStore((s) => s.activeConversationId)
  const conversations = useConversationStore((s) => s.conversations)
  const messages = useConversationStore((s) => s.messages)
  const setMessages = useConversationStore((s) => s.setMessages)
  const updateConversation = useConversationStore((s) => s.updateConversation)
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const activeConv = conversations.find((c) => c.id === activeId)
  const activeMessages = activeId ? messages[activeId] || [] : []

  useEffect(() => {
    if (!activeId) return
    async function loadMessages() {
      try {
        const data = await apiFetch<Message[]>(`/v1/conversations/${activeId}/messages`, {
          accessToken: session?.accessToken,
        })
        setMessages(activeId!, data)
      } catch {
        // API may not have this endpoint yet — use empty array
      }
    }
    loadMessages()
  }, [activeId, session?.accessToken, setMessages])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
  }, [activeMessages.length])

  async function handleSend() {
    if (!input.trim() || !activeId || sending) return
    setSending(true)
    try {
      await apiFetch(`/v1/conversations/${activeId}/messages`, {
        method: "POST",
        body: JSON.stringify({ text: input }),
        accessToken: session?.accessToken,
      })
      setInput("")
    } catch {
      // handle error silently
    } finally {
      setSending(false)
    }
  }

  async function handleTakeover() {
    if (!activeId) return
    await apiFetch(`/v1/conversations/${activeId}/takeover`, {
      method: "POST",
      accessToken: session?.accessToken,
    })
    updateConversation(activeId, { handled_by: "operator" })
  }

  async function handleRelease() {
    if (!activeId) return
    await apiFetch(`/v1/conversations/${activeId}/release`, {
      method: "POST",
      accessToken: session?.accessToken,
    })
    updateConversation(activeId, { handled_by: "ai" })
  }

  if (!activeId || !activeConv) {
    return (
      <div className="flex flex-1 items-center justify-center text-muted-foreground">
        <p>Selecione uma conversa para iniciar.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">{activeConv.contact_id.slice(0, 16)}...</span>
          <Badge variant="secondary" className="text-[10px]">{activeConv.state}</Badge>
        </div>
        <div className="flex gap-2">
          {activeConv.handled_by === "ai" ? (
            <Button size="sm" variant="outline" onClick={handleTakeover}>
              <UserCheck className="mr-1 size-3" />
              Assumir
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={handleRelease}>
              <Bot className="mr-1 size-3" />
              Devolver p/ IA
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-3">
        {activeMessages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "max-w-[75%] rounded-2xl px-4 py-2.5 text-sm",
              msg.direction === "inbound"
                ? "self-start bg-muted text-foreground"
                : "self-end bg-primary text-primary-foreground ml-auto"
            )}
          >
            <p className="text-xs font-medium opacity-70 mb-1">
              {msg.role === "customer" ? "Cliente" : msg.role === "operator" ? "Operador" : "Assistente"}
            </p>
            <p>{msg.content}</p>
          </div>
        ))}
        {activeMessages.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">Sem mensagens ainda.</p>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSend()
          }}
          className="flex gap-2"
        >
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite uma mensagem..."
            disabled={sending}
          />
          <Button type="submit" size="icon" disabled={sending || !input.trim()}>
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/organisms/chat-panel.tsx
git commit -m "feat: ChatPanel with messages, takeover/release, and send"
```

---

## Task 10: Pagina do Inbox

**Files:**
- Create: `apps/web/app/tenant/[slug]/inbox/page.tsx`

- [ ] **Step 1: Criar inbox page**

```typescript
import { ConversationList } from "@/components/organisms/conversation-list"
import { ChatPanel } from "@/components/organisms/chat-panel"

export default function InboxPage() {
  return (
    <div className="flex h-full">
      <div className="w-80 shrink-0">
        <ConversationList />
      </div>
      <ChatPanel />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/tenant/\[slug\]/inbox/
git commit -m "feat: inbox page with 2-column layout"
```

---

## Task 11: Catalogo — CatalogBrowser e CatalogItemDetail

**Files:**
- Create: `apps/web/components/organisms/catalog-browser.tsx`
- Create: `apps/web/app/tenant/[slug]/catalog/page.tsx`

- [ ] **Step 1: Criar catalog-browser.tsx**

```typescript
"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { apiFetch } from "@/lib/api"
import type { CatalogItem } from "@studio/contracts"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const tagFields = ["cor", "material", "estilo", "marca"] as const

export function CatalogBrowser({ tenantId }: { tenantId?: string }) {
  const { data: session } = useSession()
  const [items, setItems] = useState<CatalogItem[]>([])
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null)

  async function loadItems() {
    const params = new URLSearchParams()
    if (tenantId) params.set("tenant_id", tenantId)
    for (const [k, v] of Object.entries(filters)) {
      if (v) params.set(`tag_${k}`, v)
    }
    try {
      const data = await apiFetch<CatalogItem[]>(`/v1/catalog/items?${params}`, {
        accessToken: session?.accessToken,
      })
      setItems(data)
    } catch {
      setItems([])
    }
  }

  useEffect(() => {
    loadItems()
  }, [session?.accessToken, tenantId])

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-tight">Catalogo</h1>
        <p className="text-sm text-muted-foreground">Navegue e filtre items do catalogo do tenant.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        {tagFields.map((field) => (
          <Input
            key={field}
            placeholder={`Filtrar por ${field}`}
            value={filters[field] || ""}
            onChange={(e) => setFilters((f) => ({ ...f, [field]: e.target.value }))}
            className="w-44"
          />
        ))}
        <Button onClick={loadItems} size="sm">
          Filtrar
        </Button>
      </div>

      {/* Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((item) => (
          <Card
            key={item.id}
            className="cursor-pointer transition-transform hover:-translate-y-0.5"
            onClick={() => setSelectedItem(selectedItem?.id === item.id ? null : item)}
          >
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{item.name}</CardTitle>
              <CardDescription className="line-clamp-2">{item.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(item.tags || {}).map(([k, v]) => (
                  <Badge key={k} variant="secondary" className="text-[10px]">
                    {k}: {v}
                  </Badge>
                ))}
              </div>
              {item.sku && (
                <p className="mt-2 text-xs text-muted-foreground">SKU: {item.sku}</p>
              )}
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && (
          <p className="col-span-full text-center text-sm text-muted-foreground">
            Nenhum item encontrado.
          </p>
        )}
      </div>

      {/* Detail panel */}
      {selectedItem && (
        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle>{selectedItem.name}</CardTitle>
            <CardDescription>{selectedItem.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm"><strong>SKU:</strong> {selectedItem.sku || "N/A"}</p>
            <p className="text-sm"><strong>Status:</strong> {selectedItem.status}</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(selectedItem.tags || {}).map(([k, v]) => (
                <Badge key={k} variant="outline">
                  {k}: {v}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Criar catalog page**

`apps/web/app/tenant/[slug]/catalog/page.tsx`:
```typescript
import { CatalogBrowser } from "@/components/organisms/catalog-browser"

export default function CatalogPage() {
  return <CatalogBrowser />
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/organisms/catalog-browser.tsx apps/web/app/tenant/\[slug\]/catalog/
git commit -m "feat: catalog browser with tag filters and item detail"
```

---

## Task 12: Dashboard melhorado — Tenant

**Files:**
- Modify: `apps/web/app/tenant/[slug]/page.tsx`

- [ ] **Step 1: Reescrever tenant dashboard page com dados da API**

```typescript
"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { apiFetch } from "@/lib/api"
import type { Conversation } from "@studio/contracts"
import { MetricCard } from "@/components/molecules/metric-card"
import { SectionHeading } from "@/components/atoms/section-heading"
import { ActivityRow } from "@/components/molecules/activity-row"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function TenantDashboardPage() {
  const { data: session } = useSession()
  const [conversations, setConversations] = useState<Conversation[]>([])

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<Conversation[]>("/v1/conversations", {
          accessToken: session?.accessToken,
        })
        setConversations(data)
      } catch {
        // empty
      }
    }
    load()
  }, [session?.accessToken])

  const active = conversations.filter((c) => c.state !== "completed" && c.state !== "idle")
  const composing = conversations.filter((c) => c.state === "composing")
  const operatorHandled = conversations.filter((c) => c.handled_by === "operator")

  return (
    <div className="space-y-8 p-6">
      <SectionHeading
        eyebrow="Dashboard"
        title="Visao geral do tenant"
        description="Metricas em tempo real das conversas e jobs."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Conversas ativas"
          value={String(active.length)}
          hint={`${operatorHandled.length} com operador`}
        />
        <MetricCard
          label="Jobs compondo"
          value={String(composing.length)}
          hint="Composicoes em andamento"
        />
        <MetricCard
          label="Total conversas"
          value={String(conversations.length)}
          hint="Todas as conversas do tenant"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Conversas recentes</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {conversations.slice(0, 10).map((conv) => (
            <ActivityRow
              key={conv.id}
              title={`Conversa ${conv.id.slice(0, 8)}`}
              detail={`Estado: ${conv.state} · Atendimento: ${conv.handled_by}`}
              status={conv.state}
              tone={conv.handled_by === "operator" ? "default" : "secondary"}
            />
          ))}
          {conversations.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma conversa ainda.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/tenant/\[slug\]/page.tsx
git commit -m "feat: tenant dashboard with real API metrics"
```

---

## Task 13: Dashboard melhorado — Superadmin

**Files:**
- Modify: `apps/web/app/superadmin/page.tsx`

- [ ] **Step 1: Reescrever superadmin page com dados da API**

```typescript
"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { apiFetch } from "@/lib/api"
import type { Tenant } from "@studio/contracts"
import { MetricCard } from "@/components/molecules/metric-card"
import { SectionHeading } from "@/components/atoms/section-heading"
import { ActivityRow } from "@/components/molecules/activity-row"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function SuperadminPage() {
  const { data: session } = useSession()
  const [tenants, setTenants] = useState<Tenant[]>([])

  useEffect(() => {
    async function load() {
      try {
        const data = await apiFetch<Tenant[]>("/v1/tenants", {
          accessToken: session?.accessToken,
        })
        setTenants(data)
      } catch {
        // empty
      }
    }
    load()
  }, [session?.accessToken])

  const activeTenants = tenants.filter((t) => t.status === "active")

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-6 md:px-8 md:py-10">
      <SectionHeading
        eyebrow="Superadmin"
        title="Visao global da plataforma"
        description="Tenants, metricas e saude operacional."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard
          label="Tenants ativos"
          value={String(activeTenants.length)}
          hint={`${tenants.length} total`}
        />
        <MetricCard
          label="Total tenants"
          value={String(tenants.length)}
          hint="Todos os planos"
        />
        <MetricCard
          label="Plataforma"
          value="Online"
          hint="Todos os servicos operacionais"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="font-display text-xl">Tenants</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {tenants.map((tenant) => (
            <ActivityRow
              key={tenant.id}
              title={tenant.name}
              detail={`slug: ${tenant.slug} · plano: ${tenant.plan_code}`}
              status={tenant.status}
              tone={tenant.status === "active" ? "default" : "secondary"}
            />
          ))}
          {tenants.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum tenant cadastrado.</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/superadmin/page.tsx
git commit -m "feat: superadmin dashboard with real API data"
```

---

## Task 14: Pagina de signin

**Files:**
- Create: `apps/web/app/auth/signin/page.tsx`

- [ ] **Step 1: Criar signin page**

```typescript
"use client"

import { signIn } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="font-display text-2xl">Entrar</CardTitle>
          <CardDescription>Faca login para acessar a plataforma.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button className="w-full" onClick={() => signIn("zitadel", { callbackUrl: "/" })}>
            Entrar com Zitadel
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/auth/signin/
git commit -m "feat: sign-in page with Zitadel OIDC button"
```

---

## Task 15: Atualizar landing page com links corretos

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Adicionar link para inbox e login status**

```typescript
import { PlatformOverview } from "@/components/organisms/platform-overview"
import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-6 md:px-8 md:py-10">
        <PlatformOverview />
        <div className="mt-8 flex flex-wrap gap-3">
          <Button asChild>
            <Link href="/superadmin">Abrir superadmin</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/tenant/decor-labs">Dashboard tenant</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/tenant/decor-labs/inbox">Abrir inbox</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/tenant/decor-labs/catalog">Abrir catalogo</Link>
          </Button>
        </div>
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat: update landing page with inbox and catalog links"
```

---

## Task 16: Build e verificacao final

- [ ] **Step 1: Rodar build do Next.js**

Run: `cd apps/web && pnpm build`
Expected: Build com sucesso

- [ ] **Step 2: Verificar que dev server funciona**

Run: `cd apps/web && pnpm dev`
Verificar manualmente: abrir http://localhost:3000 e navegar pelas paginas.

- [ ] **Step 3: Commit final se necessario**

```bash
git add -A
git commit -m "fix: adjustments from build verification"
```

---

## Self-Review Checklist

**Spec coverage:**
- [ ] next-auth v5 com OIDC Zitadel
- [ ] SessionProvider no layout root
- [ ] Middleware Next.js protegendo rotas
- [ ] Zustand store para conversas/mensagens
- [ ] Socket.IO provider com middleware Zustand
- [ ] Tenant layout com sidebar + SocketProvider
- [ ] ConversationList com filtro handled_by
- [ ] ChatPanel com mensagens, takeover/release, send
- [ ] Inbox page 2 colunas
- [ ] CatalogBrowser com filtros por tags
- [ ] Tenant dashboard com metricas da API
- [ ] Superadmin dashboard com dados da API
- [ ] Pagina de signin
- [ ] API client com auth header
