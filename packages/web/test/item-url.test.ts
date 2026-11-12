import { describe, expect, it } from 'vitest'
import { itemHash } from '../src/lib/item-url'

describe('item URL', () => {
  it('builds the item hash route', () => {
    expect(itemHash(123 as Parameters<typeof itemHash>[0])).toBe('#/item/123')
  })
})
