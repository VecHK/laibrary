import { describe, expect, it } from 'vitest'
import {
  detectSlashQuery, filterSlashCommands, mergeTextLine, splitTextLine,
} from '../src/lib/textline-editor'

describe('slash query', () => {
  it('只在行首、无空格、光标在行尾触发', () => {
    expect(detectSlashQuery('/', 1)).toBe('')
    expect(detectSlashQuery('/图', 2)).toBe('图')
    expect(detectSlashQuery('/image', 6)).toBe('image')
    expect(detectSlashQuery('/图 ', 3)).toBeNull()
    expect(detectSlashQuery('/图', 1)).toBeNull()
    expect(detectSlashQuery('文本 /', 4)).toBeNull()
    expect(detectSlashQuery('/a/b', 4)).toBeNull()
  })

  it('中文、英文和 role 都能筛选', () => {
    expect(detectSlashQuery('/', 1)).not.toBeNull()
    expect(filterSlashCommands('').map(command => command.id)).toEqual([
      'text', 'image', 'file', 'itemlink', 'manga',
    ])
    expect(filterSlashCommands('图').map(command => command.id)).toEqual(['image'])
    expect(filterSlashCommands('img').map(command => command.id)).toEqual(['image'])
    expect(filterSlashCommands('item').map(command => command.id)).toEqual(['itemlink'])
    expect(filterSlashCommands('manga').map(command => command.id)).toEqual(['manga'])
    expect(filterSlashCommands('不存在')).toEqual([])
  })
})

describe('textline split / merge', () => {
  it('光标处拆行', () => {
    expect(splitTextLine('hello world', 5, 5)).toEqual({
      left: 'hello',
      right: ' world',
    })
    expect(splitTextLine('hello world', 0, 0)).toEqual({
      left: '',
      right: 'hello world',
    })
    expect(splitTextLine('hello world', 11, 11)).toEqual({
      left: 'hello world',
      right: '',
    })
  })

  it('选区拆行会删掉选中内容', () => {
    expect(splitTextLine('abcdef', 2, 4)).toEqual({
      left: 'ab',
      right: 'ef',
    })
  })

  it('合并上一行并返回连接点', () => {
    expect(mergeTextLine('hello ', 'world')).toEqual({
      title: 'hello world',
      caret: 6,
    })
  })
})
