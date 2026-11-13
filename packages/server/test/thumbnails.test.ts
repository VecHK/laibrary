import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { THUMBNAIL_SIZES, type BlobMeta } from '@laibrary/types'
import {
  closeDb, defined, prepareTestBlobs, prepareTestDb, testPng, truncateAll,
} from './helpers'
import type { DB } from '../src/db/client'
import type { BlobService } from '../src/blob/service'
import { CreateThumbnailService, type ThumbnailService } from '../src/thumbnails/service'
import { items, thumbnails } from '../src/db/schema'
import { createItem, deleteItem } from '../src/repo/items'
import { unwrapWrite } from '../src/write-result'

let $_db: DB
let $_blobs: BlobService
let $_service: ThumbnailService
let $_cleanup: () => Promise<void>

beforeAll(async () => {
  $_db = await prepareTestDb()
  const prepared = await prepareTestBlobs($_db)
  $_blobs = prepared.blobs
  $_cleanup = prepared.cleanup
  $_service = CreateThumbnailService({ db: $_db, blobs: $_blobs })
})

beforeEach(async () => {
  await truncateAll($_db)
})

afterAll(async () => {
  await $_cleanup()
  await closeDb($_db)
})

async function imageItem() {
  const blob = unwrapWrite(await $_blobs.putBuffer(testPng(), 'image/png'))
  return unwrapWrite(await createItem($_db, {
    role: 'image',
    title: 'pixel',
    blob_id: blob.blob.id,
    attributes: { filename: 'pixel.png' },
  }, $_blobs))
}

describe('thumbnails', () => {
  it('四档 AVIF 惰性生成', async () => {
    const image = await imageItem()
    let $metas: BlobMeta[] = []
    for (const size of THUMBNAIL_SIZES) {
      const meta = unwrapWrite(await $_service.ensure(image.id, size))
      expect(meta.mime).toBe('image/avif')
      expect(meta.width).toBe(1)
      expect(meta.height).toBe(1)
      $metas = [...$metas, meta]
    }

    const rows = await $_db.select().from(thumbnails)
    expect(rows).toHaveLength(4)
    expect(rows.map(row => row.size).toSorted((a, b) => a - b)).toEqual([...THUMBNAIL_SIZES])

    const row = defined(rows[0])
    expect(await $_blobs.exists(row.blob_id as never)).toBe(true)
  })

  it('重复 ensure 返回同一个 thumb blob', async () => {
    const image = await imageItem()
    const first = unwrapWrite(await $_service.ensure(image.id, 384))
    const second = unwrapWrite(await $_service.ensure(image.id, 384))
    expect(second.id).toBe(first.id)
  })

  it('非法尺寸 / 非 image / 不存在', async () => {
    const image = await imageItem()
    const bad_size = await $_service.ensure(image.id, 123)
    expect(bad_size.ok).toBe(false)
    if (!bad_size.ok) {
      expect(bad_size.error.code).toBe('VALIDATION')
      expect(bad_size.error.message).toContain('不支持')
    }
    const page = unwrapWrite(await createItem($_db, { role: 'page', title: 'p' }, $_blobs))
    const bad_role = await $_service.ensure(page.id, 96)
    expect(bad_role.ok).toBe(false)
    if (!bad_role.ok) {
      expect(bad_role.error.message).toContain('并不是 image')
    }
    const missing = await $_service.ensure(999999, 96)
    expect(missing.ok).toBe(false)
    if (!missing.ok) {
      expect(missing.error.code).toBe('NOT_FOUND')
      expect(missing.error.message).toContain('not found')
    }
  })

  it('删除 image 级联删除 thumbnails，blob 保留给 GC', async () => {
    const image = await imageItem()
    unwrapWrite(await $_service.ensure(image.id, 96))
    unwrapWrite(await $_service.ensure(image.id, 384))

    await deleteItem($_db, image.id)
    const rows = await $_db.select().from(thumbnails).where(eq(thumbnails.image_id, image.id))
    expect(rows).toHaveLength(0)

    const image_rows = await $_db.select().from(items).where(eq(items.id, image.id))
    expect(image_rows).toHaveLength(0)
  })
})
