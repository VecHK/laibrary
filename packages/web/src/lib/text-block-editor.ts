import type { HeadingRole, ListKind, Role, TextBlockRole } from '@laibrary/types'

export type SlashCommandId =
  | 'text' | 'heading-1' | 'heading-2' | 'heading-3'
  | 'list-bullet' | 'list-number' | 'list-alpha' | 'todo'
  | 'page' | 'page-open' | 'image' | 'file' | 'itemlink' | 'manga'
export type SlashGroupId = 'suggested' | 'basic'

export type SlashCommand = {
  id: SlashCommandId
  label: string
  description: string
  group: SlashGroupId
  role: string
  aliases: string[]
  suffix?: string | undefined
}

export const SLASH_COMMANDS: readonly SlashCommand[] = [
  {
    id: 'text',
    label: '文本',
    description: '普通文本块',
    group: 'basic',
    role: 'text-block',
    aliases: ['text', 'wenben', 'text-block'],
  },
  {
    id: 'heading-1',
    label: '一级标题',
    description: '大号标题',
    group: 'basic',
    role: 'text-heading-1',
    aliases: ['h1', 'heading1', 'heading-1', 'biaoti1'],
  },
  {
    id: 'heading-2',
    label: '二级标题',
    description: '中号标题',
    group: 'basic',
    role: 'text-heading-2',
    aliases: ['h2', 'heading2', 'heading-2', 'biaoti2'],
  },
  {
    id: 'heading-3',
    label: '三级标题',
    description: '小号标题',
    group: 'basic',
    role: 'text-heading-3',
    aliases: ['h3', 'heading3', 'heading-3', 'biaoti3'],
  },
  {
    id: 'page',
    label: '新页面',
    description: '在页面里创建子页面',
    group: 'suggested',
    role: 'page',
    aliases: ['page', '新页面', 'xinyemian', 'subpage'],
  },
  {
    id: 'page-open',
    label: '新页面',
    description: '创建子页面并立即打开',
    suffix: '创建后打开',
    group: 'suggested',
    role: 'page',
    aliases: ['page-open', '新页面打开', 'xinyemian-open', 'subpage-open'],
  },
  {
    id: 'list-bullet',
    label: '无序列表',
    description: '圆点列表项',
    group: 'basic',
    role: 'text-list',
    aliases: ['list', 'ul', 'bullet', 'liebiao'],
  },
  {
    id: 'list-number',
    label: '数字列表',
    description: '1. 2. 3. 列表项',
    group: 'basic',
    role: 'text-list',
    aliases: ['ol', 'number', 'numbered', 'shuzi'],
  },
  {
    id: 'list-alpha',
    label: '字母列表',
    description: 'a. b. c. 列表项',
    group: 'basic',
    role: 'text-list',
    aliases: ['alpha', 'abc', 'zimu'],
  },
  {
    id: 'todo',
    label: '待办事项',
    description: '可勾选的列表项',
    group: 'basic',
    role: 'text-todo',
    aliases: ['todo', 'checkbox', 'task', 'gouxuan'],
  },
  {
    id: 'image',
    label: '图片',
    description: '上传并插入图片',
    group: 'suggested',
    role: 'image',
    aliases: ['image', 'tupian', 'img'],
  },
  {
    id: 'file',
    label: '附件',
    description: '上传并插入文件',
    group: 'suggested',
    role: 'file',
    aliases: ['file', 'fujian', 'attachment'],
  },
  {
    id: 'itemlink',
    label: '链接',
    description: '链接到已有 Item',
    group: 'suggested',
    role: 'itemlink',
    aliases: ['link', 'lianjie', 'itemlink'],
  },
  {
    id: 'manga',
    label: '漫画',
    description: '插入一个漫画内容块',
    group: 'basic',
    role: 'entity · manga',
    aliases: ['manga', 'manhua', 'comic'],
  },
]

/** Slash 菜单只在行首、无空格、光标在行尾时触发。 */
export function detectSlashQuery(value: string, selectionStart: number): string | null {
  if (selectionStart !== value.length || !value.startsWith('/')) {
    return null
  } else {
    const query = value.slice(1)
    if (query.includes('/') || /\s/.test(query)) {
      return null
    } else {
      return query
    }
  }
}

export type SlashCommandGroup = {
  readonly id: SlashGroupId
  readonly label: string
  readonly commands: readonly SlashCommand[]
}

const SLASH_GROUPS: readonly { id: SlashGroupId, label: string }[] = [
  { id: 'suggested', label: '建议' },
  { id: 'basic', label: '基础块' },
]

export function orderSlashCommands(commands: readonly SlashCommand[]): readonly SlashCommand[] {
  return groupSlashCommands(commands).flatMap(group => group.commands)
}

export function groupSlashCommands(commands: readonly SlashCommand[]): readonly SlashCommandGroup[] {
  return SLASH_GROUPS.map(group => ({
    ...group,
    commands: commands.filter(command => command.group === group.id),
  })).filter(group => group.commands.length !== 0)
}

export function filterSlashCommands(query: string): readonly SlashCommand[] {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) {
    return SLASH_COMMANDS
  } else {
    return SLASH_COMMANDS.filter(command => (
      command.label.toLowerCase().includes(needle) ||
      command.role.toLowerCase().includes(needle) ||
      command.aliases.some(alias => alias.includes(needle)) ||
      (command.suffix?.toLowerCase().includes(needle) ?? false)
    ))
  }
}

export function splitTextBlock(
  value: string,
  selection_start: number,
  selection_end: number,
): { left: string, right: string } {
  const start = Math.max(0, Math.min(selection_start, value.length))
  const end = Math.max(start, Math.min(selection_end, value.length))
  return {
    left: value.slice(0, start),
    right: value.slice(end),
  }
}

export function mergeTextBlock(
  previous: string,
  current: string,
): { title: string, caret: number } {
  return {
    title: `${previous}${current}`,
    caret: previous.length,
  }
}


export function detectHeadingShortcut(
  value: string,
  role: Role,
): { role: HeadingRole, title: string } | null {
  const match = /^(#{1,3}) /.exec(value)
  if (role !== 'text-block' || match === null) {
    return null
  } else {
    const rest = value.slice(match[0].length)
    if (rest.trim().length !== 0) {
      return null
    } else if (match[1] === '#') {
      return { role: 'text-heading-1', title: '' }
    } else if (match[1] === '##') {
      return { role: 'text-heading-2', title: '' }
    } else {
      return { role: 'text-heading-3', title: '' }
    }
  }
}

export function splitTextBlocks(text: string): readonly string[] {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  let $blocks: string[] = []
  let $blank_run = 0
  for (const line of lines) {
    if (line.trim().length === 0) {
      $blank_run += 1
    } else {
      if ($blocks.length !== 0 && $blank_run >= 2) {
        $blocks = [...$blocks, '']
      }
      $blocks = [...$blocks, line]
      $blank_run = 0
    }
  }
  return $blocks
}


export type ListShortcut =
  | { readonly role: 'text-list', readonly list_kind: ListKind, readonly title: '' }
  | { readonly role: 'text-todo', readonly checked: false, readonly title: '' }

export function detectListShortcut(value: string, role: Role): ListShortcut | null {
  if (role !== 'text-block') {
    return null
  } else if (value.startsWith('- ') && value.slice(2).trim().length === 0) {
    return { role: 'text-list', list_kind: 'bullet', title: '' }
  } else if (value.startsWith('1. ') && value.slice(3).trim().length === 0) {
    return { role: 'text-list', list_kind: 'number', title: '' }
  } else if (value.startsWith('a. ') && value.slice(3).trim().length === 0) {
    return { role: 'text-list', list_kind: 'alpha', title: '' }
  } else if ((value.startsWith('[] ') || value.startsWith('【】 ')) && value.trim().length === 2) {
    return { role: 'text-todo', checked: false, title: '' }
  } else {
    return null
  }
}

export type TextRoleConversion = {
  readonly role: TextBlockRole
  readonly title: string
  readonly attributes?: Readonly<Record<string, unknown>> | undefined
}
