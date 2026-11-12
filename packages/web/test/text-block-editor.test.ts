import { describe, expect, it } from 'vitest'
import {
  detectHeadingShortcut, detectListShortcut, detectSlashQuery, filterSlashCommands,
  groupSlashCommands, mergeTextBlock, orderSlashCommands, splitTextBlock, splitTextBlocks,
} from '../src/lib/text-block-editor'

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
      'text', 'heading-1', 'heading-2', 'heading-3', 'page', 'page-open',
      'list-bullet', 'list-number', 'list-alpha', 'todo', 'image', 'file', 'itemlink', 'manga',
    ])
    expect(filterSlashCommands('图').map(command => command.id)).toEqual(['image'])
    expect(filterSlashCommands('img').map(command => command.id)).toEqual(['image'])
    expect(filterSlashCommands('item').map(command => command.id)).toEqual(['itemlink'])
    expect(filterSlashCommands('新页面').map(command => command.id)).toEqual(['page', 'page-open'])
    expect(filterSlashCommands('打开').map(command => command.id)).toEqual(['page-open'])
    expect(filterSlashCommands('manga').map(command => command.id)).toEqual(['manga'])
    expect(filterSlashCommands('不存在')).toEqual([])
  })

  it('orders commands by the displayed group order', () => {
    const ordered = orderSlashCommands(filterSlashCommands(''))
    expect(ordered[0]?.id).toBe('page')
    expect(ordered.map(command => command.id)).toEqual([
      'page', 'page-open', 'image', 'file', 'itemlink',
      'text', 'heading-1', 'heading-2', 'heading-3',
      'list-bullet', 'list-number', 'list-alpha', 'todo', 'manga',
    ])
  })

  it('groups commands for the Notion-style menu', () => {
    const groups = groupSlashCommands(filterSlashCommands(''))
    expect(groups.map(group => group.id)).toEqual(['suggested', 'basic'])
    expect(groups[0]?.commands.map(command => command.id)).toEqual([
      'page', 'page-open', 'image', 'file', 'itemlink',
    ])
    expect(groups[1]?.commands.map(command => command.id)).toEqual([
      'text', 'heading-1', 'heading-2', 'heading-3',
      'list-bullet', 'list-number', 'list-alpha', 'todo', 'manga',
    ])
    expect(groupSlashCommands([])).toEqual([])
  })
})

describe('text-block split / merge', () => {
  it('光标处拆行', () => {
    expect(splitTextBlock('hello world', 5, 5)).toEqual({
      left: 'hello',
      right: ' world',
    })
    expect(splitTextBlock('hello world', 0, 0)).toEqual({
      left: '',
      right: 'hello world',
    })
    expect(splitTextBlock('hello world', 11, 11)).toEqual({
      left: 'hello world',
      right: '',
    })
  })

  it('选区拆行会删掉选中内容', () => {
    expect(splitTextBlock('abcdef', 2, 4)).toEqual({
      left: 'ab',
      right: 'ef',
    })
  })

  it('合并上一行并返回连接点', () => {
    expect(mergeTextBlock('hello ', 'world')).toEqual({
      title: 'hello world',
      caret: 6,
    })
  })
})

describe('splitTextBlocks', () => {
  it('splits lines and ignores a single blank line', () => {
    expect(splitTextBlocks('a\nb')).toEqual(['a', 'b'])
    expect(splitTextBlocks('a\n\nb')).toEqual(['a', 'b'])
  })

  it('creates one empty block for two or more blank lines', () => {
    expect(splitTextBlocks('a\n\n\nb')).toEqual(['a', '', 'b'])
    expect(splitTextBlocks('a\n\n\n\nb')).toEqual(['a', '', 'b'])
  })

  it('treats whitespace-only lines as blank and drops edges', () => {
    expect(splitTextBlocks('\n\na\n \n\t\nb\n\n')).toEqual(['a', '', 'b'])
    expect(splitTextBlocks('  \n\t')).toEqual([])
  })

  it('normalizes CRLF and CR', () => {
    expect(splitTextBlocks('a\r\n\r\n\r\nb')).toEqual(['a', '', 'b'])
    expect(splitTextBlocks('a\rb')).toEqual(['a', 'b'])
  })
})


describe('heading shortcut', () => {
  it('converts an otherwise empty text-block at line start', () => {
    expect(detectHeadingShortcut('# ', 'text-block')).toEqual({
      role: 'text-heading-1',
      title: '',
    })
    expect(detectHeadingShortcut('##   ', 'text-block')).toEqual({
      role: 'text-heading-2',
      title: '',
    })
    expect(detectHeadingShortcut('### ', 'text-block')).toEqual({
      role: 'text-heading-3',
      title: '',
    })
  })

  it('does not convert blocks with other content or wrong roles', () => {
    expect(detectHeadingShortcut('# hi', 'text-block')).toBeNull()
    expect(detectHeadingShortcut('#### ', 'text-block')).toBeNull()
    expect(detectHeadingShortcut('x# ', 'text-block')).toBeNull()
    expect(detectHeadingShortcut('# ', 'text-heading-1')).toBeNull()
  })
})


describe('list shortcuts', () => {
  it('converts empty text-block prefixes', () => {
    expect(detectListShortcut('- ', 'text-block')).toEqual({ role: 'text-list', list_kind: 'bullet', title: '' })
    expect(detectListShortcut('1. ', 'text-block')).toEqual({ role: 'text-list', list_kind: 'number', title: '' })
    expect(detectListShortcut('a. ', 'text-block')).toEqual({ role: 'text-list', list_kind: 'alpha', title: '' })
    expect(detectListShortcut('[] ', 'text-block')).toEqual({ role: 'text-todo', checked: false, title: '' })
    expect(detectListShortcut('【】 ', 'text-block')).toEqual({ role: 'text-todo', checked: false, title: '' })
  })

  it('requires an otherwise empty text-block', () => {
    expect(detectListShortcut('- x', 'text-block')).toBeNull()
    expect(detectListShortcut('1.x', 'text-block')).toBeNull()
    expect(detectListShortcut('b. ', 'text-block')).toBeNull()
    expect(detectListShortcut('[]', 'text-block')).toBeNull()
    expect(detectListShortcut('- ', 'text-heading-1')).toBeNull()
  })
})
