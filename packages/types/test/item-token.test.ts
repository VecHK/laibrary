import { describe, expect, it } from 'vitest'
import {
  extractItemTokenIds, formatItemToken, parseItemTokens,
} from '../src/item-token'

describe('inline item tokens', () => {
  it('解析、标签、纯文本', () => {
    const tokens = parseItemTokens('a [[item:12]] b [[item:34|标签]] c')
    expect(tokens).toEqual([
      { type: 'text', text: 'a ' },
      { type: 'item', target_id: 12, label: null, raw: '[[item:12]]' },
      { type: 'text', text: ' b ' },
      { type: 'item', target_id: 34, label: '标签', raw: '[[item:34|标签]]' },
      { type: 'text', text: ' c' },
    ])
  })

  it('提取 id、格式化、转义', () => {
    expect(extractItemTokenIds('[[item:1]] [[item:2|b]] [[item:1]]')).toEqual([1, 2])
    expect(formatItemToken(3, null)).toBe('[[item:3]]')
    expect(formatItemToken(3, 'x')).toBe('[[item:3|x]]')
    expect(parseItemTokens('\\[[item:1]]')).toEqual([
      { type: 'text', text: '\\[[item:1]]' },
    ])
  })

  it('非法 id 当作文本', () => {
    expect(parseItemTokens('[[item:0]]')).toEqual([{ type: 'text', text: '[[item:0]]' }])
  })
})
