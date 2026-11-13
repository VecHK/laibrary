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

  constructor(
    code: ErrorCode,
    message: string,
    status: number,
    issues?: unknown,
    options?: ErrorOptions,
  ) {
    super(message, options)
    this.name = 'AppError'
    this.code = code
    this.status = status
    this.issues = issues
  }
}

export function errorsIsAppError(err: unknown): err is AppError {
  return err instanceof AppError
}

export function errorsBadRequest(message: string, issues?: unknown): AppError {
  return new AppError('BAD_REQUEST', message, 400, issues)
}

export function errorsValidation(message: string, issues?: unknown): AppError {
  return new AppError('VALIDATION', message, 400, issues)
}

export function errorsNotFound(message: string): AppError {
  return new AppError('NOT_FOUND', message, 404)
}

export function errorsConflict(message: string): AppError {
  return new AppError('CONFLICT', message, 409)
}

export function errorsPayloadTooLarge(message: string): AppError {
  return new AppError('PAYLOAD_TOO_LARGE', message, 413)
}

export function errorsStorage(message: string, cause?: unknown): AppError {
  return new AppError(
    'STORAGE_ERROR',
    message,
    500,
    undefined,
    cause === undefined ? undefined : { cause },
  )
}

export function errorsInternal(message: string, cause?: unknown): AppError {
  return new AppError(
    'INTERNAL',
    message,
    500,
    undefined,
    cause === undefined ? undefined : { cause },
  )
}

function hasCode(value: unknown): value is { code?: unknown, cause?: unknown } {
  return typeof value === 'object' && value !== null
}

/** Drizzle wraps driver errors; walk the cause chain for PostgreSQL error codes. */
export function errorsPgCode(err: unknown): string | undefined {
  let $current: unknown = err
  for (let $depth = 0; $depth < 5 && $current !== null && $current !== undefined; $depth += 1) {
    if (hasCode($current) && typeof $current.code === 'string') {
      return $current.code
    }
    $current = hasCode($current) ? $current.cause : undefined
  }
  return undefined
}
