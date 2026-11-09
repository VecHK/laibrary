import { describe, expect, it } from 'vitest'
import { hashParse, hashRouteTo } from '../src/lib/hash-router'

describe('hash-router', () => {
  it('parseHash', () => {
    expect(hashParse('')).toEqual({ name: 'plaza' })
    expect(hashParse('#/')).toEqual({ name: 'plaza' })
    expect(hashParse('#/plaza')).toEqual({ name: 'plaza' })
    expect(hashParse('#/item/42')).toEqual({ name: 'item', id: 42 })
    expect(hashParse('#/item/abc')).toEqual({ name: 'plaza' })
    expect(hashParse('#/settings')).toEqual({ name: 'settings' })
  })

  it('routeToHash', () => {
    expect(hashRouteTo({ name: 'plaza' })).toBe('#/plaza')
    expect(hashRouteTo({ name: 'item', id: 7 })).toBe('#/item/7')
    expect(hashRouteTo({ name: 'settings' })).toBe('#/settings')
  })
})
