import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { DB } from '../src/db/client'
import type { BlobService } from '../src/blob/service'
import { closeDb, prepareTestBlobs, prepareTestDb, truncateAll } from './helpers'
import { createItem, getItem } from '../src/repo/items'
import { deleteItems, restoreItems } from '../src/repo/item-batch'
import { newTag } from '../src/repo/tags'
import { unwrapWrite, type WriteResult } from '../src/write-result'

let $_db: DB
let $_blobs: BlobService
let $_cleanup: () => Promise<void>

beforeAll(async () => {
  $_db = await prepareTestDb()
  const prepared = await prepareTestBlobs($_db)
  $_blobs = prepared.blobs
  $_cleanup = prepared.cleanup
})

beforeEach(async () => {
  await truncateAll($_db)
})

afterAll(async () => {
  await $_cleanup()
  await closeDb($_db)
})

async function expectWriteFailure(
  write: Promise<WriteResult<unknown>>,
  message: string,
): Promise<void> {
  const result = await write
  if (result.ok) {
    expect.fail('expected write failure')
  } else {
    expect(result.error.message).toContain(message)
  }
}

describe('deleteItems / restoreItems', () => {
  it('物理删除子树并保持恢复后的 item id', async () => {
    const page = unwrapWrite(await createItem($_db, { role: 'page', title: 'page' }, $_blobs))
    const first = unwrapWrite(await createItem($_db, {
      role: 'text-block',
      title: 'one',
      parent_id: page.id,
      order_index: 1,
    }, $_blobs))
    const second = unwrapWrite(await createItem($_db, {
      role: 'text-block',
      title: 'two',
      parent_id: page.id,
      order_index: 2,
    }, $_blobs))

    const snapshots = unwrapWrite(await deleteItems($_db, [page.id]))
    expect(snapshots.map(item => item.id).toSorted()).toEqual(
      [page.id, first.id, second.id].toSorted(),
    )
    await expect(getItem($_db, page.id)).rejects.toThrow()

    const restored = unwrapWrite(await restoreItems($_db, snapshots))
    expect(restored.map(item => item.id).toSorted()).toEqual(
      [page.id, first.id, second.id].toSorted(),
    )
    expect((await getItem($_db, page.id)).id).toBe(page.id)
    expect((await getItem($_db, first.id)).title).toBe('one')
    expect((await getItem($_db, second.id)).title).toBe('two')
  })

  it('恢复时保留 parent/order/blob 等字段', async () => {
    const page = unwrapWrite(await createItem($_db, { role: 'page', title: 'page' }, $_blobs))
    const child = unwrapWrite(await createItem($_db, {
      role: 'page',
      title: 'child',
      parent_id: page.id,
      order_index: 3.5,
      attributes: { icon: '📚' },
    }, $_blobs))

    const snapshots = unwrapWrite(await deleteItems($_db, [page.id]))
    const restored = unwrapWrite(await restoreItems($_db, snapshots))
    const restored_child = restored.find(item => item.id === child.id)
    expect(restored_child?.parent_id).toBe(page.id)
    expect(restored_child?.order_index).toBe(3.5)
    expect(restored_child?.attributes).toEqual({ icon: '📚' })
  })

  it('tag 不允许进入批量删除', async () => {
    const tag = unwrapWrite(await newTag($_db, 'batch tag'))
    await expectWriteFailure(deleteItems($_db, [tag.id]), 'tag')
  })

  it('恢复快照中重复 ID 会被拒绝', async () => {
    const page = unwrapWrite(await createItem($_db, { role: 'page', title: 'page' }, $_blobs))
    const snapshots = unwrapWrite(await deleteItems($_db, [page.id]))
    await expectWriteFailure(restoreItems($_db, [...snapshots, ...snapshots]), '重复')
  })
})
