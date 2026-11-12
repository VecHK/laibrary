import { describe, expect, it } from 'vitest'
import { formatItemDate } from '../src/lib/date-format'

describe('formatItemDate', () => {
  it('formats valid ISO dates', () => {
    expect(formatItemDate('2026-01-02T03:04:05.000Z')).not.toBe('')
    expect(formatItemDate('2026-01-02T03:04:05.000Z')).not.toBe('2026-01-02T03:04:05.000Z')
  })

  it('falls back to the raw value for invalid dates', () => {
    expect(formatItemDate('not-a-date')).toBe('not-a-date')
  })
})
