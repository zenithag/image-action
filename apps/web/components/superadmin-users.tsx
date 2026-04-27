"use client"

import { useEffect, useMemo, useState } from "react"
import {
  CheckCircle2,
  Clock,
  Loader2,
  Mail,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
  XCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type AuthUserStatus = "active" | "disabled"

type SuperadminUser = {
  id: string
  name: string
  email: string
  tenantId: string | null
  tenantSlug: string | null
  roles: string[]
  status: AuthUserStatus
  createdAt: string
  updatedAt: string
  lastLoginAt?: string
}

type CreateForm = {
  name: string
  email: string
  password: string
  passwordConfirmation: string
  status: AuthUserStatus
}

type EditForm = CreateForm

const initialCreateForm: CreateForm = {
  name: "",
  email: "",
  password: "",
  passwordConfirmation: "",
  status: "active",
}

const statusConfig: Record<AuthUserStatus, { label: string; icon: typeof CheckCircle2; className: string }> = {
  active: { label: "Ativo", icon: CheckCircle2, className: "bg-primary/15 text-primary" },
  disabled: { label: "Desativado", icon: XCircle, className: "bg-destructive/15 text-destructive" },
}

function getPasswordChecks(password: string) {
  return [
    { label: "12 caracteres", valid: password.length >= 12 },
    { label: "letra maiuscula", valid: /[A-Z]/.test(password) },
    { label: "letra minuscula", valid: /[a-z]/.test(password) },
    { label: "numero", valid: /[0-9]/.test(password) },
    { label: "caractere especial", valid: /[^A-Za-z0-9]/.test(password) },
  ]
}

function formatDate(value?: string) {
  if (!value) return "Nunca"

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value))
}

function buildEditForm(user: SuperadminUser): EditForm {
  return {
    name: user.name,
    email: user.email,
    password: "",
    passwordConfirmation: "",
    status: user.status,
  }
}

function sortUsers(users: SuperadminUser[]) {
  return [...users].sort((left, right) => left.name.localeCompare(right.name, "pt-BR"))
}

export function SuperadminUsers() {
  const [users, setUsers] = useState<SuperadminUser[]>([])
  const [search, setSearch] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [editingUserId, setEditingUserId] = useState<string | null>(null)
  const [savingUserId, setSavingUserId] = useState<string | null>(null)
  const [form, setForm] = useState<CreateForm>(initialCreateForm)
  const [editForm, setEditForm] = useState<EditForm>(initialCreateForm)
  const [error, setError] = useState<string | null>(null)

  async function loadUsers() {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/superadmin/users", { cache: "no-store" })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Nao foi possivel carregar usuarios.")
      }

      setUsers(sortUsers(Array.isArray(data) ? data : []))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Nao foi possivel carregar usuarios.")
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
  }, [])

  const filteredUsers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase()

    if (!normalizedSearch) return users

    return users.filter((user) =>
      user.name.toLowerCase().includes(normalizedSearch) ||
      user.email.toLowerCase().includes(normalizedSearch)
    )
  }, [search, users])

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter((user) => user.status === "active").length,
    disabled: users.filter((user) => user.status === "disabled").length,
  }), [users])

  const passwordChecks = useMemo(() => getPasswordChecks(form.password), [form.password])
  const editPasswordChecks = useMemo(() => getPasswordChecks(editForm.password), [editForm.password])
  const isPasswordStrong = passwordChecks.every((check) => check.valid)
  const isEditPasswordValid = !editForm.password || editPasswordChecks.every((check) => check.valid)
  const canCreateUser = Boolean(
    form.name.trim() &&
    form.email.trim() &&
    isPasswordStrong &&
    form.password === form.passwordConfirmation
  )
  const canSaveEdit = Boolean(
    editForm.name.trim() &&
    editForm.email.trim() &&
    isEditPasswordValid &&
    (!editForm.password || editForm.password === editForm.passwordConfirmation)
  )

  function updateCreateField<K extends keyof CreateForm>(field: K, value: CreateForm[K]) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function updateEditField<K extends keyof EditForm>(field: K, value: EditForm[K]) {
    setEditForm((current) => ({ ...current, [field]: value }))
  }

  function beginEdit(user: SuperadminUser) {
    setError(null)
    setEditingUserId(user.id)
    setEditForm(buildEditForm(user))
  }

  function cancelEdit() {
    setEditingUserId(null)
    setEditForm(initialCreateForm)
  }

  async function createUser() {
    setIsCreating(true)
    setError(null)

    try {
      const response = await fetch("/api/superadmin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Nao foi possivel criar o usuario.")
      }

      setUsers((current) => sortUsers([data as SuperadminUser, ...current]))
      setForm(initialCreateForm)
      setIsCreateOpen(false)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nao foi possivel criar o usuario.")
    } finally {
      setIsCreating(false)
    }
  }

  async function saveUser(userId: string) {
    setSavingUserId(userId)
    setError(null)

    try {
      const response = await fetch(`/api/superadmin/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Nao foi possivel salvar o usuario.")
      }

      setUsers((current) => sortUsers(current.map((user) => user.id === userId ? data as SuperadminUser : user)))
      cancelEdit()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Nao foi possivel salvar o usuario.")
    } finally {
      setSavingUserId(null)
    }
  }

  async function removeUser(user: SuperadminUser) {
    const shouldDelete = window.confirm(`Remover o acesso de "${user.name}" ao superadmin?`)

    if (!shouldDelete) return

    setSavingUserId(user.id)
    setError(null)

    try {
      const response = await fetch(`/api/superadmin/users/${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data?.error || "Nao foi possivel remover o usuario.")
      }

      setUsers((current) => current.filter((item) => item.id !== user.id))
      if (editingUserId === user.id) cancelEdit()
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Nao foi possivel remover o usuario.")
    } finally {
      setSavingUserId(null)
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-border bg-background px-7">
        <div className="flex flex-col">
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Acesso</p>
          <h1 className="font-display text-xl font-semibold leading-tight tracking-[-0.02em] text-foreground">Usuários do superadmin</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => void loadUsers()}>
            <Clock className="mr-2 h-4 w-4" /> Atualizar
          </Button>
          <Button size="sm" onClick={() => setIsCreateOpen((current) => !current)}>
            <Plus className="mr-2 h-4 w-4" /> Novo usuário
          </Button>
        </div>
      </div>

      {error ? (
        <div className="border-b border-destructive/20 bg-destructive/10 px-6 py-3 text-sm font-medium text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 px-7 py-4 sm:grid-cols-3">
        <div className="rounded-[10px] border border-border bg-card p-4">
          <p className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground">Total</p>
          <p className="mt-1 font-mono text-[28px] font-semibold leading-none text-foreground">{stats.total}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">acessos cadastrados</p>
        </div>
        <div className="rounded-[10px] border border-border bg-card p-4">
          <p className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground">Ativos</p>
          <p className="mt-1 font-mono text-[28px] font-semibold leading-none text-primary">{stats.active}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">podem acessar o painel</p>
        </div>
        <div className="rounded-[10px] border border-border bg-card p-4">
          <p className="text-[12px] uppercase tracking-[0.08em] text-muted-foreground">Desativados</p>
          <p className="mt-1 font-mono text-[28px] font-semibold leading-none text-muted-foreground">{stats.disabled}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">mantidos para histórico</p>
        </div>
      </div>

      {isCreateOpen ? (
        <div className="border-y border-border bg-secondary/30 px-7 py-5">
          <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr_0.8fr]">
            <div className="space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Nome</label>
              <input
                value={form.name}
                onChange={(event) => updateCreateField("name", event.target.value)}
                placeholder="Nome completo"
                className="w-full rounded-[10px] border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => updateCreateField("email", event.target.value)}
                placeholder="admin@empresa.com"
                autoComplete="email"
                className="w-full rounded-[10px] border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Status</label>
              <select
                value={form.status}
                onChange={(event) => updateCreateField("status", event.target.value as AuthUserStatus)}
                className="w-full rounded-[10px] border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="active">Ativo</option>
                <option value="disabled">Desativado</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button className="w-full rounded-[10px]" disabled={isCreating || !canCreateUser} onClick={() => void createUser()}>
                {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                Adicionar
              </Button>
            </div>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div className="space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Senha forte</label>
              <input
                type="password"
                value={form.password}
                onChange={(event) => updateCreateField("password", event.target.value)}
                placeholder="Minimo 12 caracteres"
                autoComplete="new-password"
                className="w-full rounded-[10px] border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <div className="flex flex-wrap gap-1.5">
                {passwordChecks.map((check) => (
                  <span
                    key={check.label}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium uppercase",
                      check.valid ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {check.label}
                  </span>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Confirmar senha</label>
              <input
                type="password"
                value={form.passwordConfirmation}
                onChange={(event) => updateCreateField("passwordConfirmation", event.target.value)}
                placeholder="Repita a senha"
                autoComplete="new-password"
                className="w-full rounded-[10px] border border-input bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              />
              {form.passwordConfirmation && form.password !== form.passwordConfirmation ? (
                <p className="text-[11px] font-medium text-destructive">A confirmacao ainda nao confere.</p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <div className="border-b border-border px-7 py-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Buscar por nome ou email..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-[10px] border border-input bg-secondary py-2 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-7 py-6 scrollbar-hide">
        <div className="overflow-hidden rounded-[10px] border border-border bg-card">
          <table className="w-full min-w-[920px] border-collapse">
            <thead>
              <tr className="border-b border-border bg-secondary">
                <th className="px-5 py-3.5 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Usuário</th>
                <th className="px-5 py-3.5 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Status</th>
                <th className="px-5 py-3.5 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Último login</th>
                <th className="px-5 py-3.5 text-left text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Criado em</th>
                <th className="px-5 py-3.5 text-right text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-14 text-center text-sm text-muted-foreground">
                    <Loader2 className="mx-auto mb-3 h-5 w-5 animate-spin text-primary" />
                    Carregando usuários...
                  </td>
                </tr>
              ) : null}

              {!isLoading && filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center">
                    <ShieldCheck className="mx-auto mb-4 h-10 w-10 text-muted-foreground/50" />
                    <p className="font-display text-lg font-bold text-foreground">
                      {users.length === 0 ? "Nenhum superadmin cadastrado" : "Nenhum usuário encontrado"}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {users.length === 0 ? "Adicione o primeiro acesso administrativo." : "Ajuste a busca para ver outros usuários."}
                    </p>
                  </td>
                </tr>
              ) : null}

              {!isLoading && filteredUsers.map((user) => {
                const status = statusConfig[user.status]
                const StatusIcon = status.icon
                const isEditing = editingUserId === user.id
                const isSaving = savingUserId === user.id

                return (
                  <tr key={user.id} className="transition-colors hover:bg-primary/[0.02]">
                    <td className="px-5 py-4 align-top">
                      {isEditing ? (
                        <div className="grid gap-3">
                          <input
                            value={editForm.name}
                            onChange={(event) => updateEditField("name", event.target.value)}
                            className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <input
                            type="email"
                            value={editForm.email}
                            onChange={(event) => updateEditField("email", event.target.value)}
                            className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              type="password"
                              value={editForm.password}
                              onChange={(event) => updateEditField("password", event.target.value)}
                              placeholder="Nova senha opcional"
                              autoComplete="new-password"
                              className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <input
                              type="password"
                              value={editForm.passwordConfirmation}
                              onChange={(event) => updateEditField("passwordConfirmation", event.target.value)}
                              placeholder="Confirmar nova senha"
                              autoComplete="new-password"
                              className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                          </div>
                          {editForm.password ? (
                            <div className="flex flex-wrap gap-1.5">
                              {editPasswordChecks.map((check) => (
                                <span
                                  key={check.label}
                                  className={cn(
                                    "rounded-full px-2 py-0.5 text-[10px] font-medium uppercase",
                                    check.valid ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                                  )}
                                >
                                  {check.label}
                                </span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                            {user.name[0]?.toUpperCase() || <UserRound className="h-4 w-4" />}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-display text-[15px] font-semibold text-foreground">{user.name}</p>
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="h-3.5 w-3.5" />
                              {user.email}
                            </p>
                          </div>
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-4 align-top">
                      {isEditing ? (
                        <select
                          value={editForm.status}
                          onChange={(event) => updateEditField("status", event.target.value as AuthUserStatus)}
                          className="w-full rounded-[10px] border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          <option value="active">Ativo</option>
                          <option value="disabled">Desativado</option>
                        </select>
                      ) : (
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase", status.className)}>
                          <StatusIcon className="h-3.5 w-3.5" />
                          {status.label}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 align-top font-mono text-sm text-muted-foreground">{formatDate(user.lastLoginAt)}</td>
                    <td className="px-5 py-4 align-top font-mono text-sm text-muted-foreground">{formatDate(user.createdAt)}</td>
                    <td className="px-5 py-4 align-top">
                      <div className="flex justify-end gap-2">
                        {isEditing ? (
                          <>
                            <Button variant="outline" size="sm" disabled={isSaving} onClick={cancelEdit}>
                              <X className="h-4 w-4" /> Cancelar
                            </Button>
                            <Button size="sm" disabled={isSaving || !canSaveEdit} onClick={() => void saveUser(user.id)}>
                              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                              Salvar
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button variant="outline" size="sm" disabled={Boolean(savingUserId)} onClick={() => beginEdit(user)}>
                              Editar
                            </Button>
                            <Button variant="destructive" size="sm" disabled={Boolean(savingUserId)} onClick={() => void removeUser(user)}>
                              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              Remover
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
