/**
 * 把 boolean 检查包成类型谓词。
 * T 不会从 boolean 回调推断，必须显式给：Is<Gallery>(...)；
 * 或在变量上标注 (v: unknown) => v is Gallery。
 */
export function Is<T>(_check: (value: unknown) => boolean): (value: unknown) => value is T {
  return (value): value is T => _check(value)
}
