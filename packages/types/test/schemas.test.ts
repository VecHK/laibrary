import { describe, expect, it } from 'vitest'
import {
  buildRowValidator, checkAttributes, zDatabaseAttributes, zFileAttributes,
  zImageAttributes,
} from '../src/schemas'

describe('role attributes 校验', () => {
  it('file 校验必填字段', () => {
    const ok = zFileAttributes.safeParse({
      src: '1.pdf',
      filename: 'a.pdf',
      mime: 'application/pdf',
      size: 10,
    })
    expect(ok.success).toBe(true)

    const bad = zFileAttributes.safeParse({
      src: '1.pdf',
      filename: 'a.pdf',
    })
    expect(bad.success).toBe(false)
  })

  it('image 继承 file 字段', () => {
    const ok = zImageAttributes.safeParse({
      src: '2.png',
      filename: 'a.png',
      mime: 'image/png',
      size: 10,
      image_width: 100,
      image_height: 100,
    })
    expect(ok.success).toBe(true)

    const missing_dims = zImageAttributes.safeParse({
      src: '2.png',
      filename: 'a.png',
      mime: 'image/png',
      size: 10,
    })
    expect(missing_dims.success).toBe(false)
  })

  it('database schema 字段名去重', () => {
    const ok = zDatabaseAttributes.safeParse({
      schema: [{ name: 'a', type: 'string' }],
    })
    expect(ok.success).toBe(true)

    const dup = zDatabaseAttributes.safeParse({
      schema: [
        { name: 'a', type: 'string' },
        { name: 'a', type: 'number' },
      ],
    })
    expect(dup.success).toBe(false)
  })

  it('checkAttributes 按 role 分发', () => {
    expect(() => checkAttributes('file', {})).toThrow()
    expect(() => checkAttributes('item', {})).not.toThrow()
    expect(() => checkAttributes('tag', { any: 'thing' })).not.toThrow()
  })
})

describe('buildRowValidator', () => {
  it('校验声明字段类型,允许缺字段与多余 key', () => {
    const validator = buildRowValidator([
      { name: 'year', type: 'number' },
      { name: 'name', type: 'string' },
    ])

    expect(validator.safeParse({ year: 2024 }).success).toBe(true)
    expect(validator.safeParse({ name: 'x', extra: 123 }).success).toBe(true)
    expect(validator.safeParse({}).success).toBe(true)
    expect(validator.safeParse({ year: '2024' }).success).toBe(false)
    expect(validator.safeParse({ name: 123 }).success).toBe(false)
  })
})
