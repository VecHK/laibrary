import { describe, expect, it } from 'vitest'
import type { Item } from '@laibrary/types'
import { resolveModule } from '../src/modules/registry'
import { pageModule } from '../src/modules/page'
import { entityModule } from '../src/modules/entity'
import { imageModule } from '../src/modules/image'
import { databaseModule } from '../src/modules/database'
import { getKindModule, hasKindModule } from '../src/lib/kind-registry'

function makeItem(overrides: Partial<Item> & { id: number }): Item {
  return {
    role: 'page',
    kind: null,
    unity_name: null,
    title: '',
    attributes: {},
    tags: [],
    parent_id: null,
    order_index: 0,
    blob: null,
    target_id: null,
    create_date: '',
    update_date: '',
    ...overrides,
  }
}

describe('resolveModule', () => {
  it('role 模块直接命中（entity 是 role 模块）', () => {
    expect(resolveModule(makeItem({ id: 1, role: 'image' }))).toBe(imageModule)
    expect(resolveModule(makeItem({ id: 2, role: 'database' }))).toBe(databaseModule)
    expect(resolveModule(makeItem({ id: 3, role: 'page' }))).toBe(pageModule)
    expect(resolveModule(makeItem({ id: 4, role: 'entity', kind: 'manga' }))).toBe(entityModule)
  })

  it('kind registry 解析 manga，未知 kind 不命中', () => {
    expect(getKindModule('manga')?.kind).toBe('manga')
    expect(hasKindModule('manga')).toBe(true)
    expect(hasKindModule('unknown')).toBe(false)
    expect(hasKindModule(null)).toBe(false)
  })

  it('未知 kind 仍走 entity 模块（由 entity 显示 fallback）', () => {
    expect(resolveModule(makeItem({ id: 5, role: 'entity', kind: 'unknown' }))).toBe(entityModule)
  })
})
