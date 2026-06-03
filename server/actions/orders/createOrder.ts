import { z } from 'zod'
import type { ActionContext } from '../_base/context'
import { ConflictError, NotFoundError, ValidationError } from '../_base/errors'
import { withIdempotency } from '../_base/idempotency'
import { auditRepo } from '../../modules/audit/audit.repo'
import { generateOrderCode } from '../../modules/orders/order.code-gen'
import { orderRepo } from '../../modules/orders/order.repo'
import { sizeRepo } from '../../modules/sizes/size.repo'
import { variantRepo } from '../../modules/styles/variant.repo'
import { evaluateOrderAlerts } from '../../modules/alerts/alert-engine'
import { prisma } from '../../lib/prisma'

export const CreateOrderInput = z.object({
  code: z
    .string()
    .regex(/^[A-Z0-9-]{3,32}$/, 'Code must be alphanumeric with dashes')
    .optional(),
  styleVariantId: z.string().uuid(),
  ownerId: z.string().uuid().optional(),
  orderedAt: z.coerce.date().optional(),
  expectedAt: z.coerce.date().optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  notes: z.string().max(10000).optional(),
  // Optional: tạo kèm items luôn — mảng size + ratio
  items: z
    .array(
      z.object({
        sizeId: z.string().uuid(),
        ratio: z.number().int().min(0).default(0),
      }),
    )
    .default([]),
})
export type CreateOrderInput = z.infer<typeof CreateOrderInput>

export interface CreateOrderOutput {
  order: {
    id: string
    code: string
    status: 'DRAFT'
    progressPct: number
    createdAt: Date
  }
  warnings: string[]
}

export async function createOrder(
  rawInput: unknown,
  ctx: ActionContext,
): Promise<CreateOrderOutput> {
  const input = CreateOrderInput.parse(rawInput)
  if (!ctx.actor) throw new ValidationError('Action requires authenticated actor')

  return withIdempotency(ctx, 'order.create', async () => {
    const variant = await variantRepo.findById(input.styleVariantId)
    if (!variant || variant.deletedAt) {
      throw new NotFoundError('StyleVariant', input.styleVariantId)
    }

    if (input.expectedAt && input.orderedAt && input.expectedAt < input.orderedAt) {
      throw new ValidationError('expectedAt must be after orderedAt')
    }

    if (input.items.length > 0) {
      const sizeIds = input.items.map((i) => i.sizeId)
      if (new Set(sizeIds).size !== sizeIds.length) {
        throw new ValidationError('Duplicate sizeId in items')
      }
      const sizes = await sizeRepo.findManyByIds(sizeIds)
      if (sizes.length !== sizeIds.length) {
        throw new ValidationError('Some sizeIds are invalid')
      }
    }

    const code = input.code ?? (await generateOrderCode())
    const existing = await orderRepo.findByCode(code)
    if (existing) throw new ConflictError(`Order code ${code} already exists`)

    // Create order + items in one transaction
    const order = await prisma.order.create({
      data: {
        code,
        styleVariantId: input.styleVariantId,
        ownerId: input.ownerId ?? ctx.actor!.id,
        orderedAt: input.orderedAt ?? null,
        expectedAt: input.expectedAt ?? null,
        priority: input.priority,
        notes: input.notes ?? null,
        items: input.items.length
          ? {
              create: input.items.map((i) => ({
                sizeId: i.sizeId,
                ratio: i.ratio,
              })),
            }
          : undefined,
      },
    })

    await auditRepo.write({
      actorId: ctx.actor!.id,
      source: ctx.source,
      action: 'order.create',
      entityType: 'Order',
      entityId: order.id,
      before: null,
      after: order,
      requestId: ctx.requestId,
    })

    const warnings: string[] = []
    if (!input.expectedAt) warnings.push('Chưa có deadline')
    if (input.items.length === 0) warnings.push('Chưa có size items')

    evaluateOrderAlerts(order.id).catch(() => {})

    return {
      order: {
        id: order.id,
        code: order.code,
        status: 'DRAFT',
        progressPct: 0,
        createdAt: order.createdAt,
      },
      warnings,
    }
  })
}
