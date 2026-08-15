import { describe, expect, it } from 'vitest'
import { cycleSortState, orderAfter } from '../src/lib/order'

describe('orderAfter', () => {
  it('末尾追加 +1', () => {
    expect(orderAfter(3, undefined)).toBe(4)
  })

  it('与下一个取中点', () => {
    expect(orderAfter(1, 2)).toBe(1.5)
    expect(orderAfter(1.5, 2)).toBe(1.75)
  })
})

describe('cycleSortState', () => {
  it('无排序 → 升序', () => {
    expect(cycleSortState(null, 'score', 'number')).toEqual({
      name: 'score', type: 'number', desc: false,
    })
  })

  it('升序 → 降序', () => {
    expect(cycleSortState({ name: 'score', type: 'number', desc: false }, 'score', 'number'))
      .toEqual({ name: 'score', type: 'number', desc: true })
  })

  it('降序 → 取消', () => {
    expect(cycleSortState({ name: 'score', type: 'number', desc: true }, 'score', 'number'))
      .toBeNull()
  })

  it('换字段 → 新字段升序', () => {
    expect(cycleSortState({ name: 'score', type: 'number', desc: true }, 'name', 'string'))
      .toEqual({ name: 'name', type: 'string', desc: false })
  })
})
