import { describe, expect, it } from 'vitest'
import { parseHash, routeToHash } from '../src/lib/hash-router'

describe('hash-router', () => {
  it('parseHash', () => {
    expect(parseHash('')).toEqual({ name: 'plaza' })
    expect(parseHash('#/')).toEqual({ name: 'plaza' })
    expect(parseHash('#/plaza')).toEqual({ name: 'plaza' })
    expect(parseHash('#/item/42')).toEqual({ name: 'item', id: 42 })
    expect(parseHash('#/item/abc')).toEqual({ name: 'plaza' })
    expect(parseHash('#/settings')).toEqual({ name: 'settings' })
  })

  it('routeToHash', () => {
    expect(routeToHash({ name: 'plaza' })).toBe('#/plaza')
    expect(routeToHash({ name: 'item', id: 7 })).toBe('#/item/7')
    expect(routeToHash({ name: 'settings' })).toBe('#/settings')
  })
})
