import { describe, expect, it } from 'vitest'
import { resolveModule } from '../src/modules/registry'
import { pageModule } from '../src/modules/page'
import { mangaModule } from '../src/modules/manga'
import { imageModule } from '../src/modules/image'
import { databaseModule } from '../src/modules/database'

function makeItem(overrides: Partial<import('@laibrary/types').Item> & { id: number }) {
  return {
    role: 'custom' as const,
    title: '',
    attributes: {},
    tags: [],
    parent_id: null,
    order_index: 0,
    create_date: '',
    update_date: '',
    ...overrides,
  }
}

const resolver = (tag_name: string): number | undefined => {
  return tag_name === 'sys/type/manga' ? 99 : undefined
}

describe('resolveModule', () => {
  it('固定 role 模块直接命中', () => {
    expect(resolveModule(makeItem({ id: 1, role: 'image' }), resolver)).toBe(imageModule)
    expect(resolveModule(makeItem({ id: 2, role: 'database' }), resolver)).toBe(databaseModule)
  })

  it('custom 按 sys/type tag 命中 manga 模块', () => {
    const item = makeItem({ id: 3, role: 'custom', tags: [99] })
    expect(resolveModule(item, resolver)).toBe(mangaModule)
  })

  it('custom 无类型 tag 走缺省页面模块', () => {
    const item = makeItem({ id: 4, role: 'custom', tags: [123] })
    expect(resolveModule(item, resolver)).toBe(pageModule)
  })

  it('类型 tag 未注册时走缺省页面模块', () => {
    const item = makeItem({ id: 5, role: 'custom', tags: [999] })
    expect(resolveModule(item, () => undefined)).toBe(pageModule)
  })
})
