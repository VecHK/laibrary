export type Result<T, E> =
  | { readonly ok: true; readonly data: T }
  | { readonly ok: false; readonly error: E }

export function resultOk<T>(data: T): Result<T, never> {
  return { ok: true, data }
}

export function resultErr<E>(error: E): Result<never, E> {
  return { ok: false, error }
}
