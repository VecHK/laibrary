import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { __THUMBNAIL_SIZES__ } from '@laibrary/types'
import {
  closeDb, defined, prepareTestBlobs, prepareTestDb, testPng, truncateAll,
} from './helpers'
import type { DB } from '../src/db/client'
import type { BlobService } from '../src/blob/service'
import { CreateThumbnailService, type ThumbnailService } from '../src/thumbnails/service'
import { items, thumbnails } from '../src/db/schema'
import { createItem, deleteItem } from '../src/repo/items'

let db: DB
let blobs: BlobService
let service: ThumbnailService
let cleanup: () => Promise<void>

beforeAll(async () => {
  db = await prepareTestDb()
  const prepared = await prepareTestBlobs(db)
  blobs = prepared.blobs
  cleanup = prepared.cleanup
  service = CreateThumbnailService({ db, blobs })
})

beforeEach(async () => {
  await truncateAll(db)
})

afterAll(async () => {
  await cleanup()
  await closeDb(db)
})

async function imageItem() {
  const blob = await blobs.putBuffer(testPng(), 'image/png')
  return createItem(db, {
    role: 'image',
    title: 'pixel',
    blob_id: blob.blob.id,
    attributes: { filename: 'pixel.png' },
  }, blobs)
}

describe('thumbnails', () => {
  it('四档 AVIF 惰性生成', async () => {
    const image = await imageItem()
    const metas = []
    for (const size of __THUMBNAIL_SIZES__) {
      const meta = await service.ensure(image.id, size)
      expect(meta.mime).toBe('image/avif')
      expect(meta.width).toBe(1)
      expect(meta.height).toBe(1)
      metas.push(meta)
    }

    const rows = await db.select().from(thumbnails)
    expect(rows).toHaveLength(4)
    expect(rows.map(row => row.size).sort((a, b) => a - b)).toEqual([...__THUMBNAIL_SIZES__])

    const row = defined(rows[0])
    expect(await blobs.exists(row.blob_id as never)).toBe(true)
  })

  it('重复 ensure 返回同一个 thumb blob', async () => {
    const image = await imageItem()
    const first = await service.ensure(image.id, 384)
    const second = await service.ensure(image.id, 384)
    expect(second.id).toBe(first.id)
  })

  it('非法尺寸 / 非 image / 不存在', async () => {
    const image = await imageItem()
    await expect(service.ensure(image.id, 123)).rejects.toThrow('不支持')
    const page = await createItem(db, { role: 'page', title: 'p' }, blobs)
    await expect(service.ensure(page.id, 96)).rejects.toThrow('并不是 image')
    await expect(service.ensure(999999, 96)).rejects.toThrow('not found')
  })

  it('删除 image 级联删除 thumbnails，blob 保留给 GC', async () => {
    const image = await imageItem()
    await service.ensure(image.id, 96)
    await service.ensure(image.id, 384)

    await deleteItem(db, image.id)
    const rows = await db.select().from(thumbnails).where(eq(thumbnails.image_id, image.id))
    expect(rows).toHaveLength(0)

    const image_rows = await db.select().from(items).where(eq(items.id, image.id))
    expect(image_rows).toHaveLength(0)
  })
})
