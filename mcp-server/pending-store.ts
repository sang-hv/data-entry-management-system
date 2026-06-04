import { randomUUID } from 'node:crypto'

const TTL_MS = 10 * 60 * 1000 // 10 phút

export interface PendingEntry {
  id: string
  tool: string        // tên tool gốc vd 'create_order'
  args: unknown       // raw args sẽ truyền vào action
  summary: string     // text hiển thị cho user confirm
  expiresAt: Date
}

const store = new Map<string, PendingEntry>()

// Dọn expired entries mỗi 2 phút
setInterval(() => {
  const now = new Date()
  for (const [id, entry] of store.entries()) {
    if (entry.expiresAt < now) store.delete(id)
  }
}, 2 * 60 * 1000).unref()

export function createPending(tool: string, args: unknown, summary: string): PendingEntry {
  const id = randomUUID().slice(0, 8) // short ID dễ đọc
  const entry: PendingEntry = {
    id,
    tool,
    args,
    summary,
    expiresAt: new Date(Date.now() + TTL_MS),
  }
  store.set(id, entry)
  return entry
}

export function getPending(id: string): PendingEntry | undefined {
  const entry = store.get(id)
  if (!entry) return undefined
  if (entry.expiresAt < new Date()) {
    store.delete(id)
    return undefined
  }
  return entry
}

export function deletePending(id: string): boolean {
  return store.delete(id)
}
