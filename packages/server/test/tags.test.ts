import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  closeDb, prepareTestBlobs, prepareTestDb, truncateAll,
} from './helpers'
import type { DB } from '../src/db/client'
import type { BlobService } from '../src/blob/service'
import {
  deleteTag, getTagByTitle, newTag, searchTag, updateTag,
} from '../src/repo/tags'
import { createItem, getItem, listItems } from '../src/repo/items'

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

describe('tag', () => {
  it('newTag get-or-create 大小写不敏感', async () => {
    const a = await newTag(db, 'RPG')
    const b = await newTag(db, 'rpg')
    expect(a.id).toBe(b.id)
    expect(a.role).toBe('tag')
    expect(a.kind).toBeNull()
  })

  it('search / update / duplicate / empty', async () => {
    await newTag(db, '像素风')
    await newTag(db, '像素游戏')
    await newTag(db, 'RPG')

    const found = await searchTag(db, '像素')
    expect(found.map(tag => tag.title).sort()).toEqual(['像素游戏', '像素风'])

    const tag = await newTag(db, 'A')
    await newTag(db, 'B')
    await expect(updateTag(db, tag.id, { title: 'B' })).rejects.toThrow('重复')
    await expect(updateTag(db, tag.id, { title: '' })).rejects.toThrow('空')
    const renamed = await updateTag(db, tag.id, { title: 'C' })
    expect(renamed.title).toBe('C')
    expect((await getTagByTitle(db, 'c'))?.id).toBe(tag.id)
  })

  it('deleteTag 清扫引用', async () => {
    const tag = await newTag(db, '要删的')
    const a = await createItem(db, { role: 'page', title: 'a', tags: [tag.id] }, blobs)
    const b = await createItem(db, { role: 'page', title: 'b', tags: [tag.id] }, blobs)
    await deleteTag(db, tag.id)
    expect((await getItem(db, a.id)).tags).toEqual([])
    expect((await getItem(db, b.id)).tags).toEqual([])
  })

  it('has_tag 过滤', async () => {
    const tag = await newTag(db, '过滤')
    const tagged = await createItem(db, { role: 'page', tags: [tag.id] }, blobs)
    await createItem(db, { role: 'page' }, blobs)
    const rows = await listItems(db, {
      limit: 0,
      filter_rules: [{ name: 'has_tag', input: tag.id, logic: 'and' }],
    })
    expect(rows.map(item => item.id)).toEqual([tagged.id])
  })
})
