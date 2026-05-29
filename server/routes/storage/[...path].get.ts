import { extname } from 'node:path'
import { getStorage } from '../../modules/storage/storage'
import { requireAuth, toHttpError } from '../../utils/http'

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
}

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const path = getRouterParam(event, 'path') ?? ''
    if (!path) {
      throw createError({ statusCode: 400, statusMessage: 'BAD_REQUEST' })
    }

    const storage = getStorage()
    const buffer = await storage.read(path)

    const ext = extname(path).toLowerCase()
    const mime = MIME_BY_EXT[ext] ?? 'application/octet-stream'
    setHeader(event, 'Content-Type', mime)
    setHeader(event, 'Cache-Control', 'private, max-age=300')
    return buffer
  }
  catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && (err as { code?: string }).code === 'ENOENT') {
      throw createError({ statusCode: 404, statusMessage: 'NOT_FOUND' })
    }
    toHttpError(err)
  }
})
