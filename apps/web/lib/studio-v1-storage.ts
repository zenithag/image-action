import type { StudioImageArtifact, StudioCompositionStrategy, StudioScenario } from "./studio-draft"

export type StudioSession = {
  base: StudioImageArtifact | null
  references: StudioImageArtifact[]
  instruction: string
  jobId?: string
  baseImages?: StudioImageArtifact[]
  generationStrategy?: StudioCompositionStrategy
  scenarios?: StudioScenario[]
  targetOutputCount?: number
  strength?: number
  updatedAt?: string
}

// Images belong in IndexedDB: localStorage is too small for multi-image drafts.
async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("comofica-studio", 1)
    request.onupgradeneeded = () => request.result.createObjectStore("drafts")
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function loadStudioSession(slug: string): Promise<StudioSession | undefined> {
  const db = await database()
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction("drafts").objectStore("drafts").get(slug)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally { db.close() }
}

export async function saveStudioSession(slug: string, session: StudioSession) {
  const db = await database()
  try {
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("drafts", "readwrite")
      transaction.objectStore("drafts").put(session, slug)
      transaction.oncomplete = () => resolve()
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error)
    })
  } finally { db.close() }
}
