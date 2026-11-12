import { describe, expect, it } from 'vitest'
import type { Item } from '@laibrary/types'
import { CreateModuleRegistry } from '../src/modules/registry'
import { __PAGE_MODULE__ } from '../src/modules/page'
import { __ENTITY_MODULE__ } from '../src/modules/entity'
import { __IMAGE_MODULE__ } from '../src/modules/image'
import { __DATABASE_MODULE__ } from '../src/modules/database'

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
  } as Item
}

describe('CreateModuleRegistry', () => {
  it('role 模块直接命中（entity 是 role 模块）', () => {
    const registry = CreateModuleRegistry()
    expect(registry.resolve(makeItem({ id: 1, role: 'image' }))).toBe(__IMAGE_MODULE__)
    expect(registry.resolve(makeItem({ id: 2, role: 'database' }))).toBe(__DATABASE_MODULE__)
    expect(registry.resolve(makeItem({ id: 3, role: 'page' }))).toBe(__PAGE_MODULE__)
    expect(registry.resolve(makeItem({ id: 4, role: 'entity', kind: 'manga' }))).toBe(__ENTITY_MODULE__)
  })

  it('kind registry 解析 manga，未知 kind 不命中', () => {
    const registry = CreateModuleRegistry()
    expect(registry.getKind('manga')?.kind).toBe('manga')
    expect(registry.getKind('unknown')).toBeUndefined()
  })

  it('未知 kind 仍走 entity 模块（由 entity 显示 fallback）', () => {
    const registry = CreateModuleRegistry()
    expect(registry.resolve(makeItem({ id: 5, role: 'entity', kind: 'unknown' }))).toBe(__ENTITY_MODULE__)
  })
})
