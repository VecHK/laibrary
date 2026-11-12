import { describe, expect, it } from 'vitest'
import { boxFromPoints, boxesIntersect } from '../src/lib/marquee'

describe('marquee geometry', () => {
  it('normalizes boxes in every drag direction', () => {
    expect(boxFromPoints(100, 80, 20, 10)).toEqual({
      left: 20,
      top: 10,
      width: 80,
      height: 70,
    })
    expect(boxFromPoints(20, 10, 100, 80)).toEqual({
      left: 20,
      top: 10,
      width: 80,
      height: 70,
    })
  })

  it('detects intersections and ignores touching edges', () => {
    const box = { left: 10, top: 10, width: 20, height: 20 }
    expect(boxesIntersect(box, { left: 20, top: 20, width: 20, height: 20 })).toBe(true)
    expect(boxesIntersect(box, { left: 30, top: 10, width: 20, height: 20 })).toBe(false)
    expect(boxesIntersect(box, { left: 10, top: 30, width: 20, height: 20 })).toBe(false)
  })
})
