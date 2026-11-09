import { describe, expect, it } from 'vitest'
import {
  zAddItemForm, zBlobID, zDatabaseAttributes, zUnityName,
  itemBuildRowValidator, itemCheckAttributes,
} from '../src/schemas'
import { zActionPayloads } from '../src/action-schemas'

describe('role / kind / blob', () => {
  it('page 不能有 kind，entity 必须有 kind', () => {
    expect(zAddItemForm.safeParse({ role: 'page' }).success).toBe(true)
    expect(zAddItemForm.safeParse({ role: 'page', kind: 'manga' }).success).toBe(false)
    expect(zAddItemForm.safeParse({ role: 'entity' }).success).toBe(false)
    expect(zAddItemForm.safeParse({ role: 'entity', kind: 'manga' }).success).toBe(true)
  })

  it('file/image 必须提供 blob_id，其他 role 不允许', () => {
    const blob_id = 'a'.repeat(64)
    expect(zAddItemForm.safeParse({ role: 'image', blob_id }).success).toBe(true)
    expect(zAddItemForm.safeParse({ role: 'image' }).success).toBe(false)
    expect(zAddItemForm.safeParse({ role: 'file' }).success).toBe(false)
    expect(zAddItemForm.safeParse({ role: 'page', blob_id }).success).toBe(false)
  })

  it('itemlink 必须提供 target_id', () => {
    expect(zAddItemForm.safeParse({ role: 'itemlink', target_id: 1 }).success).toBe(true)
    expect(zAddItemForm.safeParse({ role: 'itemlink' }).success).toBe(false)
    expect(zAddItemForm.safeParse({ role: 'page', target_id: 1 }).success).toBe(false)
  })

  it('blob id / unity name / kind 格式', () => {
    expect(zBlobID.safeParse('a'.repeat(64)).success).toBe(true)
    expect(zBlobID.safeParse('A'.repeat(64)).success).toBe(false)
    expect(zUnityName.safeParse('page.home').success).toBe(true)
    expect(zUnityName.safeParse('Page.Home').success).toBe(false)
    expect(zUnityName.safeParse('page home').success).toBe(false)
  })
})

describe('database', () => {
  it('字段名唯一，最多一个 unity_name', () => {
    expect(zDatabaseAttributes.safeParse({
      schema: [{ name: 'a', type: 'unity_name' }, { name: 'b', type: 'string' }],
    }).success).toBe(true)
    expect(zDatabaseAttributes.safeParse({
      schema: [{ name: 'a', type: 'unity_name' }, { name: 'b', type: 'unity_name' }],
    }).success).toBe(false)
    expect(zDatabaseAttributes.safeParse({
      schema: [{ name: 'a', type: 'string' }, { name: 'a', type: 'number' }],
    }).success).toBe(false)
  })

  it('row validator 跳过 unity_name，允许缺字段和额外 key', () => {
    const validator = itemBuildRowValidator([
      { name: 'unity_name', type: 'unity_name' },
      { name: 'year', type: 'number' },
      { name: 'name', type: 'string' },
    ])
    expect(validator.safeParse({ year: 2024 }).success).toBe(true)
    expect(validator.safeParse({ year: null }).success).toBe(true)
    expect(validator.safeParse({ unity_name: 'x', extra: 1 }).success).toBe(true)
    expect(validator.safeParse({ year: '2024' }).success).toBe(false)
  })
})

describe('attributes and actions', () => {
  it('file / image / page 校验', () => {
    expect(() => itemCheckAttributes('file', {})).toThrow()
    expect(() => itemCheckAttributes('file', { filename: 'a.pdf' })).not.toThrow()
    expect(() => itemCheckAttributes('page', {})).not.toThrow()
  })

  it('listing / config payload 校验', () => {
    expect(zActionPayloads.listing.safeParse({ limit: 10 }).success).toBe(true)
    expect(zActionPayloads.listing.safeParse({ limit: -1 }).success).toBe(false)
    expect(zActionPayloads.updateConfig.safeParse({
      key: 'sys.config.gc_grace_hours', value: 24,
    }).success).toBe(true)
    expect(zActionPayloads.updateConfig.safeParse({
      key: 'Bad Key', value: 24,
    }).success).toBe(false)
  })
})
