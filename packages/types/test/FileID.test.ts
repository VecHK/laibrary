import { describe, expect, it } from 'vitest'
import { constructFileID, isFileIDShape, name2number, parseFileID } from '../src/FileID'

describe('FileID', () => {
  it('构造与解析', () => {
    const fid = constructFileID(123, 'png')
    expect(fid).toBe('123.png')
    expect(parseFileID(fid)).toEqual([123, 'png'])

    const bare = constructFileID(456)
    expect(bare).toBe('456')
    expect(parseFileID(bare)).toEqual([456, null])
  })

  it('非法构造报错', () => {
    expect(() => constructFileID(-1)).toThrow()
    expect(() => constructFileID(1.5)).toThrow()
    expect(() => constructFileID(1, 'png!')).toThrow()
  })

  it('isFileIDShape', () => {
    expect(isFileIDShape('123.png')).toBe(true)
    expect(isFileIDShape('123')).toBe(true)
    expect(isFileIDShape('abc.png')).toBe(false)
    expect(isFileIDShape(123)).toBe(false)
  })

  it('name2number', () => {
    expect(name2number('123')).toBe(123)
    expect(() => name2number('abc')).toThrow()
  })
})
