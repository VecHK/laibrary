import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { DB } from '../src/db/client'
import type { BlobService } from '../src/blob/service'
import { closeDb, prepareTestBlobs, prepareTestDb, truncateAll } from './helpers'
import { createItem, getItem } from '../src/repo/items'
import { deleteItems, restoreItems } from '../src/repo/item-batch'
import { newTag } from '../src/repo/tags'

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

describe('deleteItems / restoreItems', () => {
  it('物理删除子树并保持恢复后的 item id', async () => {
    const page = await createItem(db, { role: 'page', title: 'page' }, blobs)
    const first = await createItem(db, {
      role: 'textline',
      title: 'one',
      parent_id: page.id,
      order_index: 1,
    }, blobs)
    const second = await createItem(db, {
      role: 'textline',
      title: 'two',
      parent_id: page.id,
      order_index: 2,
    }, blobs)

    const snapshots = await deleteItems(db, [page.id])
    expect(snapshots.map(item => item.id).sort()).toEqual(
      [page.id, first.id, second.id].sort(),
    )
    await expect(getItem(db, page.id)).rejects.toThrow()

    const restored = await restoreItems(db, snapshots)
    expect(restored.map(item => item.id).sort()).toEqual(
      [page.id, first.id, second.id].sort(),
    )
    expect((await getItem(db, page.id)).id).toBe(page.id)
    expect((await getItem(db, first.id)).title).toBe('one')
    expect((await getItem(db, second.id)).title).toBe('two')
  })

  it('恢复时保留 parent/order/blob 等字段', async () => {
    const page = await createItem(db, { role: 'page', title: 'page' }, blobs)
    const child = await createItem(db, {
      role: 'page',
      title: 'child',
      parent_id: page.id,
      order_index: 3.5,
      attributes: { icon: '📚' },
    }, blobs)

    const snapshots = await deleteItems(db, [page.id])
    const restored = await restoreItems(db, snapshots)
    const restored_child = restored.find(item => item.id === child.id)
    expect(restored_child?.parent_id).toBe(page.id)
    expect(restored_child?.order_index).toBe(3.5)
    expect(restored_child?.attributes).toEqual({ icon: '📚' })
  })

  it('tag 不允许进入批量删除', async () => {
    const tag = await newTag(db, 'batch tag')
    await expect(deleteItems(db, [tag.id])).rejects.toThrow('tag')
  })

  it('恢复快照中重复 ID 会被拒绝', async () => {
    const page = await createItem(db, { role: 'page', title: 'page' }, blobs)
    const snapshots = await deleteItems(db, [page.id])
    await expect(restoreItems(db, [...snapshots, ...snapshots])).rejects.toThrow('重复')
  })
})
