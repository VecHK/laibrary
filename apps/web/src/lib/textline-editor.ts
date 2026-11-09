export type SlashCommandId = 'text' | 'image' | 'file' | 'itemlink' | 'manga'
export type SlashGroupId = 'suggested' | 'basic'

export type SlashCommand = {
  id: SlashCommandId
  label: string
  description: string
  group: SlashGroupId
  role: string
  aliases: string[]
}

export const __SLASH_COMMANDS__: readonly SlashCommand[] = [
  {
    id: 'text',
    label: '文本',
    description: '普通文本块',
    group: 'basic',
    role: 'textline',
    aliases: ['text', 'wenben', 'textline'],
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

const __SLASH_GROUPS__: readonly { id: SlashGroupId, label: string }[] = [
  { id: 'suggested', label: '建议' },
  { id: 'basic', label: '基础块' },
]

export function groupSlashCommands(commands: readonly SlashCommand[]): readonly SlashCommandGroup[] {
  return __SLASH_GROUPS__.map(group => ({
    ...group,
    commands: commands.filter(command => command.group === group.id),
  })).filter(group => group.commands.length !== 0)
}

export function filterSlashCommands(query: string): readonly SlashCommand[] {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) {
    return __SLASH_COMMANDS__
  } else {
    return __SLASH_COMMANDS__.filter(command => (
      command.label.toLowerCase().includes(needle) ||
      command.role.toLowerCase().includes(needle) ||
      command.aliases.some(alias => alias.includes(needle))
    ))
  }
}

export function splitTextLine(
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

export function mergeTextLine(
  previous: string,
  current: string,
): { title: string, caret: number } {
  return {
    title: `${previous}${current}`,
    caret: previous.length,
  }
}
