import { describe, expect, it } from 'vitest'
import { Is } from '../src/is'

type Named = { name: string }

const isNamed = Is<Named>(value =>
  typeof value === 'object' && value !== null && 'name' in value,
)

describe('Is', () => {
  it('narrows to the checked type', () => {
    expect(isNamed({ name: 'x' })).toBe(true)
    expect(isNamed({})).toBe(false)
    expect(isNamed(null)).toBe(false)
  })
})
