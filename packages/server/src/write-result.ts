import { resultErr, resultOk, type Result } from '@laibrary/types'
import { AppError, type ErrorCode } from './errors'

/** Failure data carried by domain write results; not an Error subclass. */
export type WriteFailure = {
  readonly code: ErrorCode
  readonly message: string
  readonly issues?: unknown
  readonly cause?: unknown
}

export type WriteResult<T> = Result<T, WriteFailure>

export function writeOk<T>(data: T): WriteResult<T> {
  return resultOk(data)
}

export function writeErr(err: unknown): WriteResult<never> {
  return resultErr(writeFailureOf(err))
}

export function writeFailureOf(err: unknown): WriteFailure {
  if (err instanceof AppError) {
    return {
      code: err.code,
      message: err.message,
      ...(err.issues === undefined ? {} : { issues: err.issues }),
      cause: err,
    }
  } else {
    return {
      code: 'INTERNAL',
      message: err instanceof Error ? err.message : String(err),
      cause: err,
    }
  }
}

/** Run a domain mutation and turn expected/unexpected throws into failure data. */
export async function writeRun<T>(run: () => Promise<T>): Promise<WriteResult<T>> {
  try {
    return writeOk(await run())
  } catch (err) {
    return writeErr(err)
  }
}

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION: 400,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  STORAGE_ERROR: 500,
  INTERNAL: 500,
}

export function errorsFromWriteFailure(failure: WriteFailure): AppError {
  return new AppError(
    failure.code,
    failure.message,
    STATUS_BY_CODE[failure.code],
    failure.issues,
    failure.cause === undefined ? undefined : { cause: failure.cause },
  )
}

/** Boundary adapters unwrap Result back into wire data/AppError. */
export function unwrapWrite<T>(result: WriteResult<T>): T {
  if (result.ok) {
    return result.data
  } else {
    throw errorsFromWriteFailure(result.error)
  }
}
