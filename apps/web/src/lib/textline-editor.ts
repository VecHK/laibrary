export type SlashCommandId = 'text' | 'image' | 'file' | 'itemlink' | 'manga'

export type SlashCommand = {
  id: SlashCommandId
  label: string
  description: string
  icon: string
  role: string
  aliases: string[]
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'text',
    label: '文本',
    description: '普通文本块',
    icon: 'T',
    role: 'textline',
    aliases: ['text', 'wenben', 'textline'],
  },
  {
    id: 'image',
    label: '图片',
    description: '上传并插入图片',
    icon: '🖼️',
    role: 'image',
    aliases: ['image', 'tupian', 'img'],
  },
  {
    id: 'file',
    label: '附件',
    description: '上传并插入文件',
    icon: '📎',
    role: 'file',
    aliases: ['file', 'fujian', 'attachment'],
  },
  {
    id: 'itemlink',
    label: '链接',
    description: '链接到已有 Item',
    icon: '🔗',
    role: 'itemlink',
    aliases: ['link', 'lianjie', 'itemlink'],
  },
  {
    id: 'manga',
    label: '漫画',
    description: '插入一个漫画内容块',
    icon: '📖',
    role: 'entity · manga',
    aliases: ['manga', 'manhua', 'comic'],
  },
]

/** Slash 菜单只在行首、无空格、光标在行尾时触发。 */
export function detectSlashQuery(value: string, selectionStart: number): string | null {
  if (selectionStart !== value.length) return null
  if (!value.startsWith('/')) return null
  const query = value.slice(1)
  if (query.includes('/') || /\s/.test(query)) return null
  return query
}

export function filterSlashCommands(query: string): SlashCommand[] {
  const needle = query.trim().toLowerCase()
  if (needle.length === 0) return SLASH_COMMANDS
  return SLASH_COMMANDS.filter(command => (
    command.label.toLowerCase().includes(needle) ||
    command.role.toLowerCase().includes(needle) ||
    command.aliases.some(alias => alias.includes(needle))
  ))
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
