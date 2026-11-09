import { describe, expect, it } from 'vitest'
import { as } from '../src/as'
import type { BlobID } from '../src/roles'

describe('as', () => {
  it('returns the same value', () => {
    const raw = 'a'.repeat(64)
    const id = as<BlobID>(raw)
    expect(id).toBe(raw)
  })
})
