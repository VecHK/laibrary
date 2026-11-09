import { describe, expect, it } from 'vitest'
import type { Item } from '@laibrary/types'
import { blockCanDelete, blockCanDuplicate } from '../src/lib/page-blocks'

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

describe('block actions', () => {
  it('allows duplicating leaves and disallows containers', () => {
    expect(blockCanDuplicate(item('page'))).toBe(false)
    expect(blockCanDuplicate(item('database'))).toBe(false)
    expect(blockCanDuplicate(item('textline'))).toBe(true)
    expect(blockCanDuplicate(item('entity'))).toBe(true)
    expect(blockCanDuplicate(item('itemlink'))).toBe(true)
    expect(blockCanDelete(item('page'))).toBe(false)
    expect(blockCanDelete(item('database'))).toBe(false)
    expect(blockCanDelete(item('textline'))).toBe(true)
  })
})
