import { batchRepo } from '../../modules/batches/batch.repo'
import { buildContext, requireAuth, toHttpError } from '../../utils/http'
import { NotFoundError } from '../../actions/_base/errors'
import { sumBatchQty } from '../../modules/orders/order.totals'

export default defineEventHandler(async (event) => {
  try {
    requireAuth(event)
    buildContext(event)
    const id = getRouterParam(event, 'id')!
    const batch = await batchRepo.findById(id)
    if (!batch) throw new NotFoundError('OrderBatch', id)
    return { batch, total: sumBatchQty([batch]) }
  }
  catch (err) {
    toHttpError(err)
  }
})
