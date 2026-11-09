import { describe, expect, it } from 'vitest'
import { clampImageWidth, pickThumbSize } from '../src/lib/image-thumb'

describe('pickThumbSize', () => {
  it('picks the smallest thumbnail that covers the displayed width', () => {
    expect(pickThumbSize(50)).toBe(96)
    expect(pickThumbSize(100)).toBe(384)
    expect(pickThumbSize(400)).toBe(800)
    expect(pickThumbSize(900)).toBe(1440)
    expect(pickThumbSize(900, 2)).toBe(1440)
  })

  it('has a stable fallback and never exceeds 1440', () => {
    expect(pickThumbSize(0)).toBe(384)
    expect(pickThumbSize(1440, 3)).toBe(1440)
  })

  it('clamps image display width to 80..1440 and the container', () => {
    expect(clampImageWidth(50, 708)).toBe(80)
    expect(clampImageWidth(500, 708)).toBe(500)
    expect(clampImageWidth(2000, 1600)).toBe(1440)
    expect(clampImageWidth(600, 400)).toBe(400)
    expect(clampImageWidth(2000, 400)).toBe(400)
  })
})
