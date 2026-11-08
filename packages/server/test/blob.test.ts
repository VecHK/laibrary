import fs from 'node:fs/promises'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  closeDb, prepareTestBlobs, prepareTestDb, testPng, truncateAll,
} from './helpers'
import type { DB } from '../src/db/client'
import type { BlobService } from '../src/blob/service'
import { blobs as blobs_table } from '../src/db/schema'
import { cleanUnreferencedBlobs, collectReferencedBlobIds } from '../src/blob/gc'
import { createItem } from '../src/repo/items'

const DAY = 24 * 60 * 60 * 1000

let db: DB
let blobs: BlobService
let cleanup: () => Promise<void>

beforeAll(async () => {
  db = await prepareTestDb()
  const prepared = await prepareTestBlobs(db)
  blobs = prepared.blobs
  cleanup = prepared.cleanup
})

beforeEach(async () => {
  await truncateAll(db)
})

afterAll(async () => {
  await cleanup()
  await closeDb(db)
})

describe('blob store', () => {
  it('内容寻址、扇出路径、去重', async () => {
    const buf = testPng()
    const first = await blobs.putBuffer(buf, 'image/png')
    const second = await blobs.putBuffer(buf, 'image/png')

    expect(first.blob.id).toMatch(/^[0-9a-f]{64}$/)
    expect(second.blob.id).toBe(first.blob.id)
    expect(second.reused).toBe(true)
    expect(first.blob.mime).toBe('image/png')
    expect(first.blob.width).toBe(1)
    expect(first.blob.height).toBe(1)

    const path = blobs.pathFor(first.blob.id)
    expect(path).toContain(`${first.blob.id.slice(0, 2)}/${first.blob.id.slice(2, 4)}`)
    expect((await fs.stat(path)).size).toBe(buf.length)
    expect(await blobs.exists(first.blob.id)).toBe(true)
  })

  it('大一些的 buffer 也是同样的 hash', async () => {
    const a = await blobs.putBuffer(Buffer.from('hello'), 'text/plain')
    const b = await blobs.putBuffer(Buffer.from('hello'), 'text/plain')
    expect(a.blob.id).toBe(b.blob.id)
    expect(a.blob.size).toBe(5)
    expect(a.blob.width).toBeNull()
  })
})

describe('blob GC', () => {
  it('只删除无引用且超过宽限期的 blob', async () => {
    const referenced = await blobs.putBuffer(testPng(), 'image/png')
    const orphan = await blobs.putBuffer(Buffer.from('orphan'), 'application/pdf')

    await createItem(db, {
      role: 'image',
      title: 'image',
      blob_id: referenced.blob.id,
      attributes: { filename: 'pixel.png' },
    }, blobs)

    const old = new Date(Date.now() - 2 * DAY)
    await db.update(blobs_table).set({ create_date: old }).where(eq(blobs_table.id, orphan.blob.id))

    const refs = await collectReferencedBlobIds(db)
    expect(refs.has(referenced.blob.id)).toBe(true)
    expect(refs.has(orphan.blob.id)).toBe(false)

    const result = await cleanUnreferencedBlobs(db, blobs, DAY)
    expect(result.deleted).toBe(1)
    expect(await blobs.exists(referenced.blob.id)).toBe(true)
    expect(await blobs.exists(orphan.blob.id)).toBe(false)
  })

  it('宽限期内的孤儿保留', async () => {
    const orphan = await blobs.putBuffer(Buffer.from('new orphan'), 'application/pdf')
    const result = await cleanUnreferencedBlobs(db, blobs, DAY)
    expect(result.deleted).toBe(0)
    expect(await blobs.exists(orphan.blob.id)).toBe(true)
  })
})
