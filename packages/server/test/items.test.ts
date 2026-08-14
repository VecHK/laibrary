import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { prepareTestDb, truncateItems } from './helpers'
import { createItem, deleteItem, getItem, getItems, listItems, updateItem } from '../src/repo/items'
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

describe('createItem / getItem', () => {
  it('创建 item 并读取', async () => {
    const item = await createItem(db, {
      role: 'item',
      title: '测试条目',
    })
    expect(item.id).toBeGreaterThan(0)
    expect(item.role).toBe('item')
    expect(item.title).toBe('测试条目')
    expect(item.tags).toEqual([])
    expect(item.parent_id).toBeNull()

    const found = await getItem(db, item.id)
    expect(found.id).toBe(item.id)
  })

  it('attributes 按 role 校验', async () => {
    await expect(createItem(db, {
      role: 'file',
      title: 'bad file',
      attributes: {} as never,
    })).rejects.toThrow()

    const file_item = await createItem(db, {
      role: 'file',
      title: 'good file',
      attributes: {
        src: '1.pdf' as never,
        filename: 'a.pdf',
        mime: 'application/pdf',
        size: 10,
      },
    })
    expect(file_item.attributes['filename']).toBe('a.pdf')
  })

  it('tags 去重', async () => {
    const tag1 = await createItem(db, { role: 'tag', title: 'tag1' })
    const item = await createItem(db, {
      role: 'item',
      tags: [tag1.id, tag1.id],
    })
    expect(item.tags).toEqual([tag1.id])
  })
})

describe('树结构', () => {
  it('挂父自动追加 order_index', async () => {
    const parent = await createItem(db, { role: 'item', title: 'parent' })
    const a = await createItem(db, { role: 'item', parent_id: parent.id })
    const b = await createItem(db, { role: 'item', parent_id: parent.id })
    expect(a.order_index).toBe(1)
    expect(b.order_index).toBe(2)
  })

  it('插中间可传小数 order_index', async () => {
    const parent = await createItem(db, { role: 'item', title: 'parent' })
    await createItem(db, { role: 'item', parent_id: parent.id })
    await createItem(db, { role: 'item', parent_id: parent.id })
    await createItem(db, { role: 'item', parent_id: parent.id, order_index: 1.5 })

    const children = await listItems(db, {
      sort_by: 'id',
      limit: 0,
      filter_rules: [{ name: 'parent', input: parent.id, logic: 'and' }],
    })
    expect(children.map(c => c.order_index).sort((x, y) => x - y)).toEqual([1, 1.5, 2])
  })

  it('移动 item 并拒绝环', async () => {
    const a = await createItem(db, { role: 'item', title: 'a' })
    const b = await createItem(db, { role: 'item', title: 'b' })
    const c = await createItem(db, { role: 'item', title: 'c', parent_id: b.id })

    await expect(updateItem(db, b.id, { parent_id: c.id })).rejects.toThrow('后代')

    const moved = await updateItem(db, c.id, { parent_id: a.id })
    expect(moved.parent_id).toBe(a.id)
  })

  it('拒绝删除有子项的 item', async () => {
    const parent = await createItem(db, { role: 'item', title: 'parent' })
    await createItem(db, { role: 'item', parent_id: parent.id })

    await expect(deleteItem(db, parent.id)).rejects.toThrow('子项')

    const child = await createItem(db, { role: 'item', title: 'child', parent_id: parent.id })
    await deleteItem(db, child.id)
  })
})

describe('database role', () => {
  it('行写入按 schema 校验,允许缺字段与多余 key', async () => {
    const database = await createItem(db, {
      role: 'database',
      title: '游戏库',
      attributes: {
        schema: [
          { name: 'release_year', type: 'number' },
          { name: 'platform', type: 'string' },
        ],
      },
    })

    const row = await createItem(db, {
      role: 'item',
      title: '某个游戏',
      parent_id: database.id,
      attributes: {
        release_year: 2020,
        platform: 'PC',
        extra_key: '允许多余',
      },
    })
    expect(row.attributes['release_year']).toBe(2020)

    await expect(createItem(db, {
      role: 'item',
      parent_id: database.id,
      attributes: { release_year: '不是数字' },
    })).rejects.toThrow()

    await expect(updateItem(db, row.id, {
      attributes: { platform: 123 },
    })).rejects.toThrow()
  })

  it('schema 字段名不能重复', async () => {
    await expect(createItem(db, {
      role: 'database',
      attributes: {
        schema: [
          { name: 'a', type: 'string' },
          { name: 'a', type: 'number' },
        ],
      },
    })).rejects.toThrow()
  })
})

describe('getItems', () => {
  it('按 id 顺序返回', async () => {
    const a = await createItem(db, { role: 'item', title: 'a' })
    const b = await createItem(db, { role: 'item', title: 'b' })
    const c = await createItem(db, { role: 'item', title: 'c' })

    const items = await getItems(db, [c.id, a.id, b.id])
    expect(items.map(i => i.title)).toEqual(['c', 'a', 'b'])
  })
})
