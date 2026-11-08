export type ErrorCode =
  | 'VALIDATION'
  | 'BAD_REQUEST'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PAYLOAD_TOO_LARGE'
  | 'STORAGE_ERROR'
  | 'INTERNAL'

export class AppError extends Error {
  readonly code: ErrorCode
  readonly status: number
  readonly issues?: unknown

  constructor(code: ErrorCode, message: string, status: number, issues?: unknown) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.status = status
    this.issues = issues
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError
}

export function badRequest(message: string, issues?: unknown): AppError {
  return new AppError('BAD_REQUEST', message, 400, issues)
}

export function validationError(message: string, issues?: unknown): AppError {
  return new AppError('VALIDATION', message, 400, issues)
}

export function notFound(message: string): AppError {
  return new AppError('NOT_FOUND', message, 404)
}

export function conflict(message: string): AppError {
  return new AppError('CONFLICT', message, 409)
}

export function storageError(message: string, cause?: unknown): AppError {
  const error = new AppError('STORAGE_ERROR', message, 500)
  if (cause !== undefined) {
    ;(error as Error & { cause?: unknown }).cause = cause
  }
  return error
}

export function internalError(message: string, cause?: unknown): AppError {
  const error = new AppError('INTERNAL', message, 500)
  if (cause !== undefined) {
    ;(error as Error & { cause?: unknown }).cause = cause
  }
  return error
}

/** Drizzle wraps driver errors; walk the cause chain for PostgreSQL error codes. */
export function pgErrorCode(err: unknown): string | undefined {
  let current: unknown = err
  for (let depth = 0; depth < 5 && current !== null && current !== undefined; depth += 1) {
    if (typeof current === 'object' && 'code' in current) {
      const code = (current as { code?: unknown }).code
      if (typeof code === 'string') return code
    }
    current = (current as { cause?: unknown }).cause
  }
  return undefined
}
