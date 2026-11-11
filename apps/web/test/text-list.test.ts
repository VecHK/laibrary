import { describe, expect, it } from 'vitest'
import type { Item, ItemID, ListKind, RoleAttributes } from '@laibrary/types'
import { alphaLabel, listKindOf, listMarkerFor } from '../src/lib/text-list'

function listItem(id: number, list_kind: ListKind): Item {
  return {
    id: id as ItemID,
    role: 'text-list',
    kind: null,
    unity_name: null,
    title: '',
    attributes: { list_kind } as RoleAttributes['text-list'],
    tags: [],
    parent_id: null,
    order_index: id,
    blob: null,
    target_id: null,
    create_date: '',
    update_date: '',
  }
}

function textItem(id: number): Item {
  return { ...listItem(id, 'bullet'), role: 'text-block', attributes: {} }
}

describe('text list markers', () => {
  it('numbers consecutive items and restarts on breaks', () => {
    const list = [listItem(1, 'number'), listItem(2, 'number'), textItem(3), listItem(4, 'number')]
    expect(listMarkerFor(list, 0)).toBe('1.')
    expect(listMarkerFor(list, 1)).toBe('2.')
    expect(listMarkerFor(list, 2)).toBeNull()
    expect(listMarkerFor(list, 3)).toBe('1.')
  })

  it('uses alphabetic labels and bullet markers', () => {
    const list = [listItem(1, 'alpha'), listItem(2, 'alpha'), listItem(3, 'bullet')]
    expect(listMarkerFor(list, 0)).toBe('a.')
    expect(listMarkerFor(list, 1)).toBe('b.')
    expect(listMarkerFor(list, 2)).toBe('•')
    expect(alphaLabel(26)).toBe('z')
    expect(alphaLabel(27)).toBe('aa')
  })

  it('defaults missing list_kind to bullet', () => {
    const item = { ...listItem(1, 'bullet'), attributes: {} }
    expect(listKindOf(item)).toBe('bullet')
    expect(listMarkerFor([item], 0)).toBe('•')
  })
})
