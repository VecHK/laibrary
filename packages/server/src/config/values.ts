import { match } from 'ts-pattern'
import type { ConfigValueType } from '@laibrary/types'
import { resultErr, resultOk, type Result } from '@laibrary/types'
import { errorsValidation } from '../errors'

export type ConfigValueError = {
  readonly message: string
}

export function configEncodeValue(type: ConfigValueType, value: unknown): string {
  return match(type)
    .with('string', () => {
      if (typeof value !== 'string') {
        throw errorsValidation('配置值需要字符串')
      }
      return value
    })
    .with('number', () => {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw errorsValidation('配置值需要有限数字')
      }
      return String(value)
    })
    .with('boolean', () => {
      if (typeof value !== 'boolean') {
        throw errorsValidation('配置值需要布尔值')
      }
      return value ? 'true' : 'false'
    })
    .with('json', () => JSON.stringify(value))
    .exhaustive()
}

export function configDecodeValue(
  type: ConfigValueType,
  raw: unknown,
): Result<unknown, ConfigValueError> {
  if (typeof raw !== 'string') {
    return resultErr({ message: `配置值不是字符串（type=${type}）` })
  }

  return match(type)
    .with('string', () => resultOk(raw))
    .with('number', () => {
      const value = Number(raw)
      if (Number.isFinite(value)) {
        return resultOk(value)
      }
      return resultErr({ message: `配置值不是数字: ${raw}` })
    })
    .with('boolean', () => {
      if (raw === 'true') {
        return resultOk(true)
      } else if (raw === 'false') {
        return resultOk(false)
      } else {
        return resultErr({ message: `配置值不是布尔值: ${raw}` })
      }
    })
    .with('json', () => {
      try {
        const parsed: unknown = JSON.parse(raw)
        return resultOk(parsed)
      } catch (cause) {
        return resultErr({ message: `配置值不是合法 JSON: ${String(cause)}` })
      }
    })
    .exhaustive()
}

export function configTypeOf(raw: unknown): ConfigValueType {
  return match(raw)
    .with('string', () => 'string' as const)
    .with('number', () => 'number' as const)
    .with('boolean', () => 'boolean' as const)
    .with('json', () => 'json' as const)
    .otherwise(() => 'json')
}
