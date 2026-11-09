export type AsInput<T> =
  [T] extends [number] ? number :
  [T] extends [string] ? string :
  [T] extends [boolean] ? boolean :
  [T] extends [bigint] ? bigint :
  [T] extends [symbol] ? symbol :
  [T] extends [object] ? object :
  never

/**
 * 不校验的断言。只允许在测试/fixture、或已经过运行时检查的边界使用。
 * AsInput<T> 只挡住 null/undefined 和错误的原始类型/对象类别；
 * 它不校验形状、字面量或品牌的业务约束。
 */
export function as<T>(value: AsInput<T>): T {
  return value as T
}
