import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { prepareTestDb, truncateItems } from './helpers'
import { deleteTag, getTagByTitle, newTag, searchTag, updateTag } from '../src/repo/tags'
import { createItem, getItem, listItems } from '../src/repo/items'
import type { DB } from '../src/db/client'

let db: DB

beforeAll(async () => {
  db = await prepareTestDb()
})

beforeEach(async () => {
  await truncateItems(db)
})

afterAll(async () => {
  await (db as unknown as { $client: { end(): Promise<void> } }).$client.end()
})

describe('tag', () => {
  it('newTag 创建,重名(不分大小写)返回已有', async () => {
    const tag_a = await newTag(db, 'RPG')
    const tag_b = await newTag(db, 'rpg')

    expect(tag_a.id).toBe(tag_b.id)
    expect(tag_a.role).toBe('tag')
  })

  it('getTagByTitle 不分大小写', async () => {
    await newTag(db, '音乐')
    const found = await getTagByTitle(db, '音乐')
    expect(found).not.toBeNull()
  })

  it('searchTag 包含匹配', async () => {
    await newTag(db, '像素风')
    await newTag(db, '像素游戏')
    await newTag(db, 'RPG')

    const found = await searchTag(db, '像素')
    expect(found.map(t => t.title).sort()).toEqual(['像素游戏', '像素风'])
  })

  it('updateTag 改名,重名报错', async () => {
    const tag = await newTag(db, 'A')
    await newTag(db, 'B')

    await expect(updateTag(db, tag.id, { title: 'B' })).rejects.toThrow('重复')
    await expect(updateTag(db, tag.id, { title: '' })).rejects.toThrow('空')

    const updated = await updateTag(db, tag.id, { title: 'C' })
    expect(updated.title).toBe('C')
  })

  it('deleteTag 清扫所有引用它的 item', async () => {
    const tag = await newTag(db, '要删的')
    const item_a = await createItem(db, { role: 'item', tags: [tag.id] })
    const item_b = await createItem(db, { role: 'item', tags: [tag.id] })

    await deleteTag(db, tag.id)

    const a = await getItem(db, item_a.id)
    const b = await getItem(db, item_b.id)
    expect(a.tags).toEqual([])
    expect(b.tags).toEqual([])
  })

  it('deleteItem 删除 tag 时同样清扫引用', async () => {
    const tag = await newTag(db, '清扫测试')
    const item_a = await createItem(db, { role: 'item', tags: [tag.id] })

    const { deleteItem } = await import('../src/repo/items')
    await deleteItem(db, tag.id)

    const a = await getItem(db, item_a.id)
    expect(a.tags).toEqual([])
  })

  it('has_tag 过滤', async () => {
    const tag = await newTag(db, '过滤测试')
    const with_tag = await createItem(db, { role: 'item', tags: [tag.id] })
    await createItem(db, { role: 'item' })

    const found = await listItems(db, {
      limit: 0,
      filter_rules: [{ name: 'has_tag', input: tag.id, logic: 'and' }],
    })
    expect(found.map(i => i.id)).toEqual([with_tag.id])
  })
})
