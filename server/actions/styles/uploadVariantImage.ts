import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { NotFoundError, ValidationError } from '../_base/errors'
import { auditRepo } from '../../modules/audit/audit.repo'
import { getStorage } from '../../modules/storage/storage'
import { variantRepo } from '../../modules/styles/variant.repo'

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp'])
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export const UploadVariantImageInput = z.object({
  variantId: z.string().uuid(),
  filename: z.string().min(1).max(255),
  contentType: z.string().min(1),
  buffer: z.instanceof(Buffer),
})
export type UploadVariantImageInput = z.infer<typeof UploadVariantImageInput>

export async function uploadVariantImage(rawInput: unknown, ctx: ActionContext) {
  const input = UploadVariantImageInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  if (!ALLOWED_MIME.has(input.contentType.toLowerCase())) {
    throw new ValidationError(
      `Unsupported image type: ${input.contentType}. Allowed: png, jpeg, webp`,
    )
  }
  if (input.buffer.byteLength > MAX_BYTES) {
    throw new ValidationError(
      `File too large: ${input.buffer.byteLength} bytes (max ${MAX_BYTES})`,
    )
  }

  const variant = await variantRepo.findById(input.variantId)
  if (!variant) throw new NotFoundError('StyleVariant', input.variantId)

  const storage = getStorage()

  // Save new image first.
  const saved = await storage.save({
    buffer: input.buffer,
    originalName: input.filename,
    contentType: input.contentType,
    folder: 'variants',
  })

  // Update variant to point to new image.
  const updated = await variantRepo.update(input.variantId, {
    imageUrl: saved.storagePath,
  })

  // Best-effort delete of old image (ignore failures).
  if (variant.imageUrl && variant.imageUrl !== saved.storagePath) {
    try {
      await storage.delete(variant.imageUrl)
    }
    catch {
      // ignore — the new image is already saved and DB updated.
    }
  }

  await auditRepo.write({
    actorId: ctx.actor!.id,
    source: ctx.source,
    action: 'styleVariant.uploadImage',
    entityType: 'StyleVariant',
    entityId: updated.id,
    before: { imageUrl: variant.imageUrl },
    after: { imageUrl: updated.imageUrl, sizeBytes: saved.sizeBytes },
    requestId: ctx.requestId,
  })

  return {
    variant: updated,
    publicUrl: storage.publicUrl(saved.storagePath),
  }
}
