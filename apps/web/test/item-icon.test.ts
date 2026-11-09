import { describe, expect, it } from 'vitest'
import type { Item } from '@laibrary/types'
import { itemIconAttributes, itemIconOf } from '../src/modules/item-icon'

function item(overrides: Partial<Item>): Item {
  return {
    id: 1 as Item['id'],
    role: 'page',
    kind: null,
    unity_name: null,
    title: 'page',
    attributes: {},
    tags: [],
    parent_id: null,
    order_index: 1,
    blob: null,
    target_id: null,
    create_date: '',
    update_date: '',
    ...overrides,
  }
}

describe('item icons', () => {
  it('uses page/database/itemlink fallbacks', () => {
    expect(itemIconOf(item({ role: 'page' }))).toBe('📄')
    expect(itemIconOf(item({ role: 'database', attributes: { schema: [] } }))).toBe('🗄️')
    expect(itemIconOf(item({ role: 'itemlink', target_id: 2 as Item['id'] }))).toBe('🔗')
  })

  it('reads valid custom icons and ignores invalid ones', () => {
    expect(itemIconOf(item({ attributes: { icon: '📚' } }))).toBe('📚')
    expect(itemIconOf(item({ attributes: { icon: 1 } }))).toBe('📄')
  })

  it('preserves database schema and removes icon', () => {
    const db = item({ role: 'database', attributes: { schema: [], icon: '🗄️' } })
    expect(itemIconOf(db)).toBe('🗄️')
    expect(itemIconAttributes(db, '📊')).toEqual({ schema: [], icon: '📊' })
    expect(itemIconAttributes(db, null)).toEqual({ schema: [] })
  })
})
