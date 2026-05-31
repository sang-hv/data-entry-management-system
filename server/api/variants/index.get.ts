import { prisma } from '../../lib/prisma'
import { requireAuth, toHttpError } from '../../utils/http'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    // Returns all active variants flattened — for picker dropdowns.
    const variants = await prisma.styleVariant.findMany({
      where: {
        deletedAt: null,
        active: true,
        style: { deletedAt: null, active: true },
      },
      include: { style: true },
      orderBy: [{ style: { code: 'asc' } }, { name: 'asc' }],
    })

    return {
      items: variants.map((v) => ({
        id: v.id,
        styleCode: v.style.code,
        styleName: v.style.name,
        variantName: v.name,
        imageUrl: v.imageUrl,
      })),
    }
  }
  catch (err) {
    toHttpError(err)
  }
})
