import { describe, expect, it } from 'vitest'
import { resultErr, resultOk } from '../src/result'

describe('Result', () => {
  it('ok and err stay narrow', () => {
    const ok = resultOk(1)
    const err = resultErr('nope')
    expect(ok.ok).toBe(true)
    if (ok.ok) {
      expect(ok.data).toBe(1)
    }
    expect(err.ok).toBe(false)
    if (!err.ok) {
      expect(err.error).toBe('nope')
    }
  })
})
