import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  closeDb, prepareTestBlobs, prepareTestDb, truncateAll,
} from './helpers'
import type { DB } from '../src/db/client'
import type { BlobService } from '../src/blob/service'
import {
  deleteTag, getTagByTitle, newTag, searchTag, updateTag,
} from '../src/repo/tags'
import { createItem, getItem } from '../src/repo/items'
import { listItems } from '../src/repo/item-listing'

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

describe('tag', () => {
  it('newTag get-or-create 大小写不敏感', async () => {
    const a = await newTag($_db, 'RPG')
    const b = await newTag($_db, 'rpg')
    expect(a.id).toBe(b.id)
    expect(a.role).toBe('tag')
    expect(a.kind).toBeNull()
  })

  it('search / update / duplicate / empty', async () => {
    await newTag($_db, '像素风')
    await newTag($_db, '像素游戏')
    await newTag($_db, 'RPG')

    const found = await searchTag($_db, '像素')
    expect(found.map(tag => tag.title).toSorted()).toEqual(['像素游戏', '像素风'])

    const tag = await newTag($_db, 'A')
    await newTag($_db, 'B')
    await expect(updateTag($_db, tag.id, { title: 'B' })).rejects.toThrow('重复')
    await expect(updateTag($_db, tag.id, { title: '' })).rejects.toThrow('空')
    const renamed = await updateTag($_db, tag.id, { title: 'C' })
    expect(renamed.title).toBe('C')
    expect((await getTagByTitle($_db, 'c'))?.id).toBe(tag.id)
  })

  it('deleteTag 清扫引用', async () => {
    const tag = await newTag($_db, '要删的')
    const a = await createItem($_db, { role: 'page', title: 'a', tags: [tag.id] }, $_blobs)
    const b = await createItem($_db, { role: 'page', title: 'b', tags: [tag.id] }, $_blobs)
    await deleteTag($_db, tag.id)
    expect((await getItem($_db, a.id)).tags).toEqual([])
    expect((await getItem($_db, b.id)).tags).toEqual([])
  })

  it('has_tag 过滤', async () => {
    const tag = await newTag($_db, '过滤')
    const tagged = await createItem($_db, { role: 'page', tags: [tag.id] }, $_blobs)
    await createItem($_db, { role: 'page' }, $_blobs)
    const rows = await listItems($_db, {
      limit: 0,
      filter_rules: [{ name: 'has_tag', input: tag.id, logic: 'and' }],
    })
    expect(rows.map(item => item.id)).toEqual([tagged.id])
  })
})
