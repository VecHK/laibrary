import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  closeDb, defined, prepareTestBlobs, prepareTestDb, truncateAll,
} from './helpers'
import type { DB } from '../src/db/client'
import type { BlobService } from '../src/blob/service'
import { createItem } from '../src/repo/items'
import { listItems } from '../src/repo/item-listing'
import { unwrapWrite } from '../src/write-result'

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

async function fillPages(count = 30) {
  let $ids: number[] = []
  for (let $i = 1; $i <= count; $i += 1) {
    const item = unwrapWrite(await createItem($_db, {
      role: 'page',
      title: `条目${$i}`,
      attributes: { group: $i % 2 === 0 ? 'even' : 'odd', score: $i },
    }, $_blobs))
    $ids = [...$ids, item.id]
  }
  return $ids
}

describe('listing', () => {
  it('默认按 id 升序 / keyset 不重不漏', async () => {
    const ids = await fillPages()
    const page1 = await listItems($_db, { limit: 10 })
    const page2 = await listItems($_db, { limit: 10, after_id: defined(page1[9]).id })
    const page3 = await listItems($_db, { limit: 10, after_id: defined(page2[9]).id })
    expect([...page1, ...page2, ...page3].map(item => item.id)).toEqual(ids)
  })

  it('desc / title / role / parent', async () => {
    const ids = await fillPages()
    const desc_page = await listItems($_db, { limit: 3, desc: true })
    expect(desc_page.map(item => item.id)).toEqual(ids.slice(-3).toReversed())

    const titled = await listItems($_db, {
      limit: 0,
      filter_rules: [{ name: 'title', input: '条目1', logic: 'and' }],
    })
    expect(titled).toHaveLength(11)

    const parent = unwrapWrite(await createItem($_db, { role: 'page', title: 'parent' }, $_blobs))
    unwrapWrite(await createItem($_db, { role: 'page', title: 'child', parent_id: parent.id }, $_blobs))
    const children = await listItems($_db, {
      limit: 0,
      filter_rules: [{ name: 'parent', input: parent.id, logic: 'and' }],
    })
    expect(children.map(item => item.title)).toEqual(['child'])
  })

  it('kind / unity_name / role 过滤', async () => {
    const manga = unwrapWrite(await createItem($_db, {
      role: 'entity', kind: 'manga', title: 'manga', unity_name: 'manga.one',
    }, $_blobs))
    const page = unwrapWrite(await createItem($_db, {
      role: 'page', title: 'page', unity_name: 'page.one',
    }, $_blobs))

    const by_kind = await listItems($_db, {
      limit: 0,
      filter_rules: [{ name: 'kind', input: 'manga', logic: 'and' }],
    })
    expect(by_kind.map(item => item.id)).toEqual([manga.id])

    const by_unity = await listItems($_db, {
      limit: 0,
      filter_rules: [{ name: 'unity_name', input: 'page.one', logic: 'and' }],
    })
    expect(by_unity.map(item => item.id)).toEqual([page.id])

    const by_role = await listItems($_db, {
      limit: 0,
      filter_rules: [{ name: 'role', input: 'entity', logic: 'and' }],
    })
    expect(by_role.map(item => item.id)).toEqual([manga.id])
  })

  it('attribute_equal / tag / group invert', async () => {
    const tag = unwrapWrite(await createItem($_db, { role: 'tag', title: 't' }, $_blobs))
    unwrapWrite(await createItem($_db, { role: 'page', title: 'tagged', tags: [tag.id] }, $_blobs))
    unwrapWrite(await createItem($_db, { role: 'page', title: 'plain' }, $_blobs))

    const evens = await listItems($_db, {
      limit: 0,
      filter_rules: [{ name: 'attribute_equal', input: { name: 'group', value: 'even' }, logic: 'and' }],
    })
    expect(evens).toHaveLength(0)

    const with_tag = await listItems($_db, {
      limit: 0,
      filter_rules: [{ name: 'has_tag', input: tag.id, logic: 'and' }],
    })
    expect(with_tag.map(item => item.title)).toEqual(['tagged'])

    const grouped = await listItems($_db, {
      limit: 0,
      filter_groups: [{
        logic: 'and',
        invert: true,
        rules: [{ name: 'empty_tag', input: null, logic: 'and' }],
      }],
    })
    expect(grouped.map(item => item.title)).toEqual(['tagged'])
  })

  it('sort_field number：字符串值不报错并沉底', async () => {
    const a = unwrapWrite(await createItem($_db, { role: 'page', title: 'a', attributes: { score: 1 } }, $_blobs))
    const b = unwrapWrite(await createItem($_db, { role: 'page', title: 'b', attributes: { score: 2 } }, $_blobs))
    const bad = unwrapWrite(await createItem($_db, { role: 'page', title: 'bad', attributes: { score: 'not-number' } }, $_blobs))
    const empty = unwrapWrite(await createItem($_db, { role: 'page', title: 'empty', attributes: {} }, $_blobs))

    const rows = await listItems($_db, {
      limit: 0,
      sort_field: { name: 'score', type: 'number' },
    })
    expect(rows.map(item => item.title)).toEqual(['a', 'b', 'bad', 'empty'])
    expect(rows.slice(0, 2).map(item => item.id)).toEqual([a.id, b.id])
    expect(defined(rows.at(-2)).id).toBe(bad.id)
    expect(defined(rows.at(-1)).id).toBe(empty.id)
  })

  it('sort_field keyset 不重不漏（含 null 尾巴）', async () => {
    const values = [3, 1, 2, null, 5, 4, null, 7, 6]
    let $ids: number[] = []
    for (const [index, value] of values.entries()) {
      const item = unwrapWrite(await createItem($_db, {
        role: 'page',
        title: `item${index}`,
        attributes: value === null ? {} : { score: value },
      }, $_blobs))
      $ids = [...$ids, item.id]
    }

    let $collected: number[] = []
    let $after: number | undefined
    for (let $page = 0; $page < 10; $page += 1) {
      const rows = await listItems($_db, {
        limit: 3,
        sort_field: { name: 'score', type: 'number' },
        after_id: $after,
      })
      if (rows.length === 0) {break}
      $collected = [...$collected, ...rows.map(item => item.id)]
      $after = defined(rows.at(-1)).id
    }
    expect($collected.toSorted()).toEqual($ids.toSorted())
  })
})
