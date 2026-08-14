import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { prepareTestDb, truncateItems } from './helpers'
import { createItem, listItems } from '../src/repo/items'
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

async function fillItems() {
  const ids: number[] = []
  for (let i = 1; i <= 30; ++i) {
    const item = await createItem(db, {
      role: 'item',
      title: `条目${i}`,
      attributes: { group: i % 2 === 0 ? 'even' : 'odd' },
    })
    ids.push(item.id)
  }
  return ids
}

describe('listing', () => {
  it('默认按 id 升序', async () => {
    const ids = await fillItems()
    const page = await listItems(db, { limit: 10 })
    expect(page.map(i => i.id)).toEqual(ids.slice(0, 10))
  })

  it('keyset 分页翻页不重不漏', async () => {
    const ids = await fillItems()

    const page1 = await listItems(db, { limit: 10 })
    const page2 = await listItems(db, { limit: 10, after_id: page1[9]!.id })
    const page3 = await listItems(db, { limit: 10, after_id: page2[9]!.id })

    const collected = [...page1, ...page2, ...page3].map(i => i.id)
    expect(collected).toEqual(ids)
  })

  it('desc 降序', async () => {
    const ids = await fillItems()
    const page = await listItems(db, { limit: 5, desc: true })
    expect(page.map(i => i.id)).toEqual(ids.slice(-5).reverse())
  })

  it('title 过滤', async () => {
    await fillItems()
    const found = await listItems(db, {
      limit: 0,
      filter_rules: [{ name: 'title', input: '条目1', logic: 'and' }],
    })
    expect(found.length).toBe(11)
  })

  it('role 过滤', async () => {
    await fillItems()
    await createItem(db, { role: 'tag', title: '某标签' })

    const tags = await listItems(db, {
      limit: 0,
      filter_rules: [{ name: 'role', input: 'tag', logic: 'and' }],
    })
    expect(tags.length).toBe(1)
  })

  it('attribute_equal 过滤(string/number)', async () => {
    await fillItems()
    const evens = await listItems(db, {
      limit: 0,
      filter_rules: [{
        name: 'attribute_equal',
        input: { name: 'group', value: 'even' },
        logic: 'and',
      }],
    })
    expect(evens.length).toBe(15)
  })

  it('filter group: and/or/invert', async () => {
    const tag = await createItem(db, { role: 'tag', title: 'g' })
    await createItem(db, { role: 'item', title: '带tag', tags: [tag.id] })
    await createItem(db, { role: 'item', title: '无tag' })

    const found = await listItems(db, {
      limit: 0,
      filter_groups: [
        {
          logic: 'and',
          invert: true,
          rules: [{ name: 'empty_tag', input: null, logic: 'and' }],
        },
      ],
    })
    expect(found.map(i => i.title)).toEqual(['带tag'])
  })

  it('empty_tag 过滤', async () => {
    const tag = await createItem(db, { role: 'tag', title: 't' })
    await createItem(db, { role: 'item', title: '有', tags: [tag.id] })
    await createItem(db, { role: 'item', title: '无' })

    const found = await listItems(db, {
      limit: 0,
      filter_rules: [
        { name: 'empty_tag', input: null, logic: 'and' },
        { name: 'role', input: 'item', logic: 'and' },
      ],
    })
    expect(found.map(i => i.title)).toEqual(['无'])
  })
})
