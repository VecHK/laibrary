import { describe, expect, it } from 'vitest'
import type { Item } from '@laibrary/types'
import { treeCanAddInside } from '../src/lib/sidebar-tree'

function item(role: Item['role']): Item {
  return {
    id: 1 as Item['id'],
    role,
    kind: role === 'entity' ? 'manga' : null,
    unity_name: null,
    title: '',
    attributes: role === 'database' ? { schema: [] } : {},
    tags: [],
    parent_id: null,
    order_index: 1,
    blob: null,
    target_id: role === 'itemlink' ? (2 as Item['id']) : null,
    create_date: '',
    update_date: '',
  }
}

describe('sidebar tree actions', () => {
  it('allows adding inside pages and databases', () => {
    expect(treeCanAddInside(item('page'), undefined)).toBe(true)
    expect(treeCanAddInside(item('database'), undefined)).toBe(true)
  })

  it('only allows itemlink add when target is a page', () => {
    expect(treeCanAddInside(item('itemlink'), item('page'))).toBe(true)
    expect(treeCanAddInside(item('itemlink'), item('database'))).toBe(false)
    expect(treeCanAddInside(item('itemlink'), undefined)).toBe(false)
  })
})
