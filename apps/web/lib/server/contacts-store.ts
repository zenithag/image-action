import type { TenantContact, TenantContactInput, TenantContactStatus } from "@/lib/contact-types"
import { listInboxConversations } from "@/lib/server/inbox-store"
import { readJsonStore, writeJsonStore } from "@/lib/server/postgres-json-store"
import { getRuntimeDataFile } from "@/lib/server/runtime-paths"

type ContactsData = {
  contacts: TenantContact[]
}

const dataFile = getRuntimeDataFile("tenant-contacts.json")
const storeKey = "tenant-contacts"
let mutationQueue = Promise.resolve()

async function withContactsMutation<T>(mutation: () => Promise<T>) {
  const run = mutationQueue.then(mutation, mutation)
  mutationQueue = run.then(() => undefined, () => undefined)

  return run
}

async function readContactsData(): Promise<ContactsData> {
  return readJsonStore({
    key: storeKey,
    filePath: dataFile,
    fallback: { contacts: [] },
    normalize: (parsed) => ({
      contacts: Array.isArray((parsed as Partial<ContactsData>)?.contacts)
        ? (parsed as ContactsData).contacts
        : [],
    }),
  })
}

async function writeContactsData(data: ContactsData) {
  await writeJsonStore({ key: storeKey, filePath: dataFile, fallback: { contacts: [] } }, data)
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizeEmail(value: unknown) {
  return normalizeText(value).toLowerCase() || undefined
}

function normalizeStatus(value: unknown): TenantContactStatus {
  return value === "archived" ? "archived" : "active"
}

function normalizeTags(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(normalizeText).filter(Boolean)
  }

  return normalizeText(value)
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function sortContacts(contacts: TenantContact[]) {
  return [...contacts].sort((left, right) => {
    const leftDate = left.lastContactAt ?? left.updatedAt
    const rightDate = right.lastContactAt ?? right.updatedAt

    return new Date(rightDate).getTime() - new Date(leftDate).getTime()
  })
}

async function buildInboxContacts(tenantSlug: string, storedContacts: TenantContact[]) {
  const conversations = await listInboxConversations(tenantSlug)
  const storedKeys = new Set(storedContacts.map((contact) => contact.externalContactId).filter(Boolean))
  const byExternalContact = new Map<string, TenantContact>()

  for (const conversation of conversations) {
    if (storedKeys.has(conversation.externalContactId)) {
      continue
    }

    const existing = byExternalContact.get(conversation.externalContactId)

    if (existing) {
      byExternalContact.set(conversation.externalContactId, {
        ...existing,
        conversationsCount: existing.conversationsCount + 1,
        lastContactAt: new Date(conversation.lastMessageAt) > new Date(existing.lastContactAt ?? 0)
          ? conversation.lastMessageAt
          : existing.lastContactAt,
        updatedAt: new Date(conversation.updatedAt) > new Date(existing.updatedAt)
          ? conversation.updatedAt
          : existing.updatedAt,
      })
      continue
    }

    byExternalContact.set(conversation.externalContactId, {
      id: `inbox:${conversation.externalContactId}`,
      tenantSlug,
      name: conversation.contact.name || conversation.contact.phone || conversation.externalContactId,
      phone: conversation.contact.phone,
      source: "inbox",
      status: "active",
      tags: [conversation.channelInstanceName].filter(Boolean),
      externalContactId: conversation.externalContactId,
      conversationsCount: 1,
      lastContactAt: conversation.lastMessageAt,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    })
  }

  return Array.from(byExternalContact.values())
}

export async function listContacts(tenantSlug: string) {
  const data = await readContactsData()
  const storedContacts = data.contacts.filter((contact) => contact.tenantSlug === tenantSlug)
  const inboxContacts = await buildInboxContacts(tenantSlug, storedContacts)

  return sortContacts([...storedContacts, ...inboxContacts])
}

export async function createContact(tenantSlug: string, input: TenantContactInput) {
  return withContactsMutation(async () => {
    const data = await readContactsData()
    const now = new Date().toISOString()
    const name = normalizeText(input.name)

    if (!name) {
      throw new Error("Nome do contato e obrigatorio.")
    }

    const contact: TenantContact = {
      id: crypto.randomUUID(),
      tenantSlug,
      name,
      phone: normalizeText(input.phone) || undefined,
      email: normalizeEmail(input.email),
      company: normalizeText(input.company) || undefined,
      source: "manual",
      status: normalizeStatus(input.status),
      tags: normalizeTags(input.tags),
      notes: normalizeText(input.notes) || undefined,
      externalContactId: normalizeText(input.externalContactId) || undefined,
      conversationsCount: 0,
      createdAt: now,
      updatedAt: now,
    }

    await writeContactsData({ contacts: [contact, ...data.contacts] })

    return contact
  })
}

export async function updateContact(tenantSlug: string, contactId: string, input: TenantContactInput) {
  return withContactsMutation(async () => {
    const data = await readContactsData()
    const existing = data.contacts.find((contact) => contact.tenantSlug === tenantSlug && contact.id === contactId)

    if (!existing) {
      return null
    }

    const updated: TenantContact = {
      ...existing,
      name: input.name === undefined ? existing.name : normalizeText(input.name),
      phone: input.phone === undefined ? existing.phone : normalizeText(input.phone) || undefined,
      email: input.email === undefined ? existing.email : normalizeEmail(input.email),
      company: input.company === undefined ? existing.company : normalizeText(input.company) || undefined,
      status: input.status === undefined ? existing.status : normalizeStatus(input.status),
      tags: input.tags === undefined ? existing.tags : normalizeTags(input.tags),
      notes: input.notes === undefined ? existing.notes : normalizeText(input.notes) || undefined,
      externalContactId: input.externalContactId === undefined
        ? existing.externalContactId
        : normalizeText(input.externalContactId) || undefined,
      updatedAt: new Date().toISOString(),
    }

    if (!updated.name) {
      throw new Error("Nome do contato e obrigatorio.")
    }

    await writeContactsData({
      contacts: data.contacts.map((contact) => contact.id === contactId ? updated : contact),
    })

    return updated
  })
}

export async function deleteContact(tenantSlug: string, contactId: string) {
  return withContactsMutation(async () => {
    const data = await readContactsData()
    const exists = data.contacts.some((contact) => contact.tenantSlug === tenantSlug && contact.id === contactId)

    if (!exists) {
      return false
    }

    await writeContactsData({
      contacts: data.contacts.filter((contact) => contact.tenantSlug !== tenantSlug || contact.id !== contactId),
    })

    return true
  })
}
