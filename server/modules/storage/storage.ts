import { randomUUID } from 'node:crypto'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { extname, join, normalize, resolve, sep } from 'node:path'

export interface StorageAdapter {
  /**
   * Save a buffer with a server-generated path. Returns the relative
   * `storagePath` used as the canonical reference (e.g. for DB).
   */
  save(opts: {
    buffer: Buffer
    originalName: string
    contentType: string
    folder?: string
  }): Promise<{ storagePath: string, sizeBytes: number }>

  read(storagePath: string): Promise<Buffer>
  delete(storagePath: string): Promise<void>

  /**
   * Public URL clients can use to fetch the file. For local-disk Phase 1
   * this is `/storage/<storagePath>` served by an auth-protected route.
   */
  publicUrl(storagePath: string): string
}

/**
 * Local disk storage. Files are kept under STORAGE_DIR (default ./storage/uploads).
 * The base directory is OUTSIDE Nuxt's public/ so files are not served as
 * static assets — they are only reachable through an authenticated route.
 */
export class LocalDiskStorage implements StorageAdapter {
  private readonly baseDir: string

  constructor(baseDir?: string) {
    this.baseDir = resolve(baseDir ?? process.env.STORAGE_DIR ?? './storage/uploads')
  }

  private resolveSafe(storagePath: string): string {
    // Prevent path traversal: storagePath must stay inside baseDir.
    const target = resolve(this.baseDir, normalize(storagePath))
    if (!target.startsWith(this.baseDir + sep) && target !== this.baseDir) {
      throw new Error(`Refusing to access path outside storage dir: ${storagePath}`)
    }
    return target
  }

  async save(opts: {
    buffer: Buffer
    originalName: string
    contentType: string
    folder?: string
  }) {
    const ext = extname(opts.originalName).toLowerCase().replace(/[^a-z0-9.]/g, '')
    const id = randomUUID()
    const folder = (opts.folder ?? 'misc').replace(/[^a-z0-9_/-]/gi, '_')
    const relPath = join(folder, `${id}${ext}`)
    const fullPath = this.resolveSafe(relPath)

    await mkdir(join(this.baseDir, folder), { recursive: true })
    await writeFile(fullPath, opts.buffer)

    return { storagePath: relPath, sizeBytes: opts.buffer.byteLength }
  }

  async read(storagePath: string): Promise<Buffer> {
    return readFile(this.resolveSafe(storagePath))
  }

  async delete(storagePath: string): Promise<void> {
    try {
      await unlink(this.resolveSafe(storagePath))
    }
    catch (err: unknown) {
      // Ignore not-found errors; deletion is idempotent.
      if ((err as { code?: string }).code !== 'ENOENT') throw err
    }
  }

  publicUrl(storagePath: string): string {
    return `/storage/${storagePath}`
  }
}

let _storage: StorageAdapter | undefined
let _storageBaseDir: string | undefined

export function getStorage(): StorageAdapter {
  const desired = process.env.STORAGE_DIR ?? './storage/uploads'
  if (!_storage || _storageBaseDir !== desired) {
    _storage = new LocalDiskStorage(desired)
    _storageBaseDir = desired
  }
  return _storage
}
