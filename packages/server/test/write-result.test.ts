import { describe, expect, it } from 'vitest'
import { AppError, errorsStorage } from '../src/errors'
import {
  errorsFromWriteFailure, unwrapWrite, writeFailureOf, writeRun,
} from '../src/write-result'

describe('write result failure cause', () => {
  it('preserves an AppError cause through failure data and boundary rethrow', () => {
    const root = new Error('ENOSPC')
    const original = errorsStorage('写入 blob 失败', root)

    const failure = writeFailureOf(original)

    expect(failure.code).toBe('STORAGE_ERROR')
    expect(failure.cause).toBe(original)

    const rehydrated = errorsFromWriteFailure(failure)

    expect(rehydrated).toBeInstanceOf(AppError)
    expect(rehydrated.cause).toBe(original)
    expect((rehydrated.cause as AppError).cause).toBe(root)
  })

  it('preserves a raw error from writeRun and unwrapWrite', async () => {
    const root = new Error('raw storage failure')
    const result = await writeRun(async () => {
      throw root
    })

    expect(result.ok).toBe(false)

    if (result.ok) {
      throw new Error('expected failed result')
    } else {
      expect(result.error.code).toBe('INTERNAL')
      expect(result.error.cause).toBe(root)

      let caught: unknown
      try {
        unwrapWrite(result)
      } catch (err) {
        caught = err
      }

      expect(caught).toBeInstanceOf(AppError)
      expect((caught as AppError).cause).toBe(root)
    }
  })
})
