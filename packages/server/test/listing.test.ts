import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, prepareTestDb, prepareTestFilePool, truncateItems } from './helpers'
import { createItem, listItems } from '../src/repo/items'
import type { DB } from '../src/db/client'
import type { FilePool } from '../src/blob/file-pool'

let db: DB
let pool: FilePool
let cleanup_pool: () => Promise<void>

beforeAll(async () => {
  db = await prepareTestDb()
  const prepared = await prepareTestFilePool()
  pool = prepared.pool
  cleanup_pool = prepared.cleanup
})

beforeEach(async () => {
  await truncateItems(db)
})

afterAll(async () => {
  await cleanup_pool()
  await closeDb(db)
})

async function fillItems() {
  const ids: number[] = []
  for (let i = 1; i <= 30; ++i) {
    const item = await createItem(db, {
      role: 'custom',
      title: `条目${i}`,
      attributes: { group: i % 2 === 0 ? 'even' : 'odd' },
    }, pool)
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
    await createItem(db, { role: 'tag', title: '某标签' }, pool)

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
    const tag = await createItem(db, { role: 'tag', title: 'g' }, pool)
    await createItem(db, { role: 'custom', title: '带tag', tags: [tag.id] }, pool)
    await createItem(db, { role: 'custom', title: '无tag' }, pool)

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
    const tag = await createItem(db, { role: 'tag', title: 't' }, pool)
    await createItem(db, { role: 'custom', title: '有', tags: [tag.id] }, pool)
    await createItem(db, { role: 'custom', title: '无' }, pool)

    const found = await listItems(db, {
      limit: 0,
      filter_rules: [
        { name: 'empty_tag', input: null, logic: 'and' },
        { name: 'role', input: 'custom', logic: 'and' },
      ],
    })
    expect(found.map(i => i.title)).toEqual(['无'])
  })

  it('sort_field: number 升序,空值沉底', async () => {
    await createItem(db, { role: 'custom', title: 'c', attributes: { score: 3 } }, pool)
    await createItem(db, { role: 'custom', title: 'a', attributes: { score: 1 } }, pool)
    await createItem(db, { role: 'custom', title: '空', attributes: {} }, pool)
    await createItem(db, { role: 'custom', title: 'b', attributes: { score: 2 } }, pool)

    const asc_list = await listItems(db, {
      limit: 0,
      sort_field: { name: 'score', type: 'number' },
    })
    expect(asc_list.map(i => i.title)).toEqual(['a', 'b', 'c', '空'])

    const desc_list = await listItems(db, {
      limit: 0,
      desc: true,
      sort_field: { name: 'score', type: 'number' },
    })
    expect(desc_list.map(i => i.title)).toEqual(['c', 'b', 'a', '空'])
  })

  it('sort_field: string 排序 + keyset', async () => {
    await createItem(db, { role: 'custom', title: 'bb', attributes: { name: 'bb' } }, pool)
    await createItem(db, { role: 'custom', title: 'cc', attributes: { name: 'cc' } }, pool)
    await createItem(db, { role: 'custom', title: 'aa', attributes: { name: 'aa' } }, pool)
    await createItem(db, { role: 'custom', title: 'zz', attributes: { name: 'zz' } }, pool)

    const all = await listItems(db, {
      limit: 0,
      sort_field: { name: 'name', type: 'string' },
    })
    expect(all.map(i => i.title)).toEqual(['aa', 'bb', 'cc', 'zz'])

    const page1 = await listItems(db, {
      limit: 2,
      sort_field: { name: 'name', type: 'string' },
    })
    expect(page1.map(i => i.title)).toEqual(['aa', 'bb'])

    const page2 = await listItems(db, {
      limit: 2,
      after_id: page1[1]!.id,
      sort_field: { name: 'name', type: 'string' },
    })
    expect(page2.map(i => i.title)).toEqual(['cc', 'zz'])
  })
})
