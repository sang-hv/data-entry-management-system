import { existsSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { LocalDiskStorage } from '~/server/modules/storage/storage'

describe('LocalDiskStorage', () => {
  let baseDir: string
  let storage: LocalDiskStorage

  beforeEach(async () => {
    baseDir = await mkdtemp(join(tmpdir(), 'dems-storage-'))
    storage = new LocalDiskStorage(baseDir)
  })

  afterEach(async () => {
    await rm(baseDir, { recursive: true, force: true })
  })

  it('saves a buffer and returns relative storagePath', async () => {
    const buf = Buffer.from('hello world')
    const r = await storage.save({
      buffer: buf,
      originalName: 'test.txt',
      contentType: 'text/plain',
      folder: 'variants',
    })
    expect(r.sizeBytes).toBe(buf.byteLength)
    expect(r.storagePath).toMatch(/^variants\//)
    expect(r.storagePath).toMatch(/\.txt$/)
    expect(existsSync(join(baseDir, r.storagePath))).toBe(true)
  })

  it('reads back what was saved', async () => {
    const buf = Buffer.from('content-12345')
    const r = await storage.save({
      buffer: buf,
      originalName: 'a.bin',
      contentType: 'application/octet-stream',
    })
    const read = await storage.read(r.storagePath)
    expect(read.equals(buf)).toBe(true)
  })

  it('delete removes the file', async () => {
    const r = await storage.save({
      buffer: Buffer.from('x'),
      originalName: 'a.txt',
      contentType: 'text/plain',
    })
    expect(existsSync(join(baseDir, r.storagePath))).toBe(true)
    await storage.delete(r.storagePath)
    expect(existsSync(join(baseDir, r.storagePath))).toBe(false)
  })

  it('delete is idempotent (no error on missing file)', async () => {
    await expect(storage.delete('misc/does-not-exist.bin')).resolves.toBeUndefined()
  })

  it('rejects path traversal attempts', async () => {
    await expect(storage.read('../../etc/passwd')).rejects.toThrow(
      /outside storage dir/i,
    )
  })

  it('publicUrl returns /storage/<path>', () => {
    expect(storage.publicUrl('variants/foo.jpg')).toBe('/storage/variants/foo.jpg')
  })
})
