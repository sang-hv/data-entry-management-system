import { uploadVariantImage } from '../../../actions/styles/uploadVariantImage'
import { ValidationError } from '../../../actions/_base/errors'
import { buildContext, requireAuth, toHttpError } from '../../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    const variantId = getRouterParam(event, 'id')
    const ctx = buildContext(event)

    const parts = await readMultipartFormData(event)
    if (!parts || parts.length === 0) {
      throw new ValidationError('No file in multipart payload')
    }

    const filePart = parts.find((p) => p.name === 'file' && p.filename)
    if (!filePart || !filePart.filename || !filePart.data) {
      throw new ValidationError('Missing "file" part')
    }

    return await uploadVariantImage(
      {
        variantId,
        filename: filePart.filename,
        contentType: filePart.type ?? 'application/octet-stream',
        buffer: filePart.data,
      },
      ctx,
    )
  }
  catch (err) {
    toHttpError(err)
  }
})
