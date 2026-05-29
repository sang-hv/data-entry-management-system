import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { ActionContext } from '~/server/actions/_base/context'
import { createStyle } from '~/server/actions/styles/createStyle'
import { createStyleVariant } from '~/server/actions/styles/createStyleVariant'
import { uploadVariantImage } from '~/server/actions/styles/uploadVariantImage'
import { ensureTestAdmin, resetDb } from '../../helpers/db'

const baseCtx: ActionContext = { actor: null, source: 'ui', requestId: 'req-test' }

describe('uploadVariantImage action', () => {
  let ctx: ActionContext
  let variantId: string
  let storageDir: string
  let originalEnv: string | undefined

  beforeEach(async () => {
    await resetDb()
    storageDir = await mkdtemp(join(tmpdir(), 'dems-upload-'))
    originalEnv = process.env.STORAGE_DIR
    process.env.STORAGE_DIR = storageDir

    const u = await ensureTestAdmin()
    ctx = { ...baseCtx, actor: { id: u.id, email: u.email, role: u.role } }
    const s = await createStyle({ code: 'AO083', name: 'Test' }, ctx)
    const v = await createStyleVariant({ styleId: s.style.id, name: 'BLUE' }, ctx)
    variantId = v.variant.id
  })

  afterEach(async () => {
    process.env.STORAGE_DIR = originalEnv
    await rm(storageDir, { recursive: true, force: true })
  })

  it('uploads PNG and updates variant.imageUrl', async () => {
    // tiny valid PNG header
    const pngBuf = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0, 0, 0, 0, 0, 0, 0, 0,
    ])
    const r = await uploadVariantImage(
      {
        variantId,
        filename: 'sample.png',
        contentType: 'image/png',
        buffer: pngBuf,
      },
      ctx,
    )
    expect(r.variant.imageUrl).toMatch(/^variants\//)
    expect(r.publicUrl).toMatch(/^\/storage\/variants\//)
  })

  it('rejects non-image MIME', async () => {
    await expect(
      uploadVariantImage(
        {
          variantId,
          filename: 'evil.exe',
          contentType: 'application/x-msdownload',
          buffer: Buffer.from('x'),
        },
        ctx,
      ),
    ).rejects.toThrow(/Unsupported image type/i)
  })

  it('rejects oversized image', async () => {
    const big = Buffer.alloc(6 * 1024 * 1024) // 6 MB > 5 MB limit
    await expect(
      uploadVariantImage(
        {
          variantId,
          filename: 'big.png',
          contentType: 'image/png',
          buffer: big,
        },
        ctx,
      ),
    ).rejects.toThrow(/too large/i)
  })

  it('throws NotFound when variant id is invalid', async () => {
    await expect(
      uploadVariantImage(
        {
          variantId: '00000000-0000-0000-0000-000000000000',
          filename: 'a.png',
          contentType: 'image/png',
          buffer: Buffer.from('x'),
        },
        ctx,
      ),
    ).rejects.toThrow(/not found/i)
  })

  it('replaces old image when uploading again', async () => {
    const png = Buffer.from('first')
    const first = await uploadVariantImage(
      {
        variantId,
        filename: 'a.png',
        contentType: 'image/png',
        buffer: png,
      },
      ctx,
    )
    const second = await uploadVariantImage(
      {
        variantId,
        filename: 'b.png',
        contentType: 'image/png',
        buffer: Buffer.from('second'),
      },
      ctx,
    )
    expect(second.variant.imageUrl).not.toBe(first.variant.imageUrl)
  })
})
