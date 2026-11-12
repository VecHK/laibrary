import { useEffect, useRef } from 'react'
import type { SlashCommand, SlashCommandId } from '../lib/text-block-editor'
import { groupSlashCommands } from '../lib/text-block-editor'

function CommandIcon({ id }: { id: SlashCommandId }) {
  if (id === 'text') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M4 5V4h12v1M10 4v12M7 16h6" />
      </svg>
    )
  } else if (id === 'heading-1' || id === 'heading-2' || id === 'heading-3') {
    const level = id === 'heading-1' ? '1' : (id === 'heading-2' ? '2' : '3')
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <text x="4" y="15" fontSize="10" fontWeight="700" fill="currentColor">H{level}</text>
      </svg>
    )
  } else if (id === 'list-bullet') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <circle cx="5" cy="6" r="1.3" />
        <circle cx="5" cy="10" r="1.3" />
        <circle cx="5" cy="14" r="1.3" />
        <path d="M8.5 6h7M8.5 10h7M8.5 14h7" />
      </svg>
    )
  } else if (id === 'list-number') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <text x="2" y="7" fontSize="6" fontWeight="700" fill="currentColor">1.</text>
        <text x="2" y="11.5" fontSize="6" fontWeight="700" fill="currentColor">2.</text>
        <text x="2" y="16" fontSize="6" fontWeight="700" fill="currentColor">3.</text>
        <path d="M7.5 6h9M7.5 10.5h9M7.5 15h9" />
      </svg>
    )
  } else if (id === 'list-alpha') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <text x="2" y="7" fontSize="6" fontWeight="700" fill="currentColor">a.</text>
        <text x="2" y="11.5" fontSize="6" fontWeight="700" fill="currentColor">b.</text>
        <text x="2" y="16" fontSize="6" fontWeight="700" fill="currentColor">c.</text>
        <path d="M7.5 6h9M7.5 10.5h9M7.5 15h9" />
      </svg>
    )
  } else if (id === 'todo') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="3" y="4" width="4" height="4" rx="1" />
        <rect x="3" y="12" width="4" height="4" rx="1" />
        <path d="m3.8 14 1 1 1.8-2M9.5 6h7M9.5 14h7" />
      </svg>
    )
  } else if (id === 'page' || id === 'page-open') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M5 2.5h7l3 3v12H5z" />
        <path d="M12 2.5v3h3" />
      </svg>
    )
  } else if (id === 'image') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <rect x="3" y="3.5" width="14" height="13" rx="2" />
        <circle cx="7.5" cy="7.5" r="1.2" />
        <path d="m4 14 4-4 3 3 2-2 3 3" />
      </svg>
    )
  } else if (id === 'file') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M6 2.5h5l4 4v11H6z" />
        <path d="M11 2.5v4h4" />
      </svg>
    )
  } else if (id === 'itemlink') {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M8.5 11.5 11.5 8.5" />
        <path d="M7.5 13.5 6 15a2.8 2.8 0 0 1-4-4l2-2a2.8 2.8 0 0 1 4 0" />
        <path d="M12.5 6.5 14 5a2.8 2.8 0 0 1 4 4l-2 2a2.8 2.8 0 0 1-4 0" />
      </svg>
    )
  } else {
    return (
      <svg viewBox="0 0 20 20" aria-hidden="true">
        <path d="M3 4.5h5.5A2.5 2.5 0 0 1 11 7v9a2 2 0 0 0-2-2H3z" />
        <path d="M17 4.5h-3.5A2.5 2.5 0 0 0 11 7v9a2 2 0 0 1 2-2h4z" />
      </svg>
    )
  }
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="7" cy="7" r="4" />
      <path d="m10 10 3.5 3.5" />
    </svg>
  )
}

export function SlashMenu({
  commands,
  selected_index,
  query,
  placement,
  max_height,
  onSelectIndex,
  onPick,
}: {
  commands: readonly SlashCommand[]
  selected_index: number
  query: string
  placement: 'up' | 'down'
  max_height: number
  onSelectIndex: (index: number) => void
  onPick: (command: SlashCommand) => void
}) {
  const list_ref = useRef<HTMLDivElement>(null)
  const groups = groupSlashCommands(commands)

  useEffect(() => {
    const selected = list_ref.current?.querySelector<HTMLElement>(
      `[data-command-index="${selected_index}"]`,
    )
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selected_index])

  return (
    <div
      className={`slash-menu ${placement}`}
      role="listbox"
      aria-label="插入内容"
    >
      <div className="slash-menu-search" onMouseDown={ev => ev.preventDefault()}>
        <span className="slash-menu-search-icon"><SearchIcon /></span>
        <span className={query.length === 0 ? 'slash-menu-search-placeholder' : 'slash-menu-search-text'}>
          {query.length === 0 ? '输入以搜索' : query}
        </span>
      </div>
      <div
        className="slash-menu-scroll"
        ref={list_ref}
        style={{ maxHeight: `${Math.max(120, max_height - 76)}px` }}
      >
        {groups.length === 0 ? (
          <div className="slash-menu-empty">没有匹配的内容</div>
        ) : groups.map(group => (
          <div key={group.id} className="slash-menu-group">
            <div className="slash-menu-group-title">{group.label}</div>
            {group.commands.map(command => {
              const index = commands.indexOf(command)
              return (
                <button
                  key={command.id}
                  type="button"
                  role="option"
                  aria-selected={index === selected_index}
                  data-command-index={index}
                  className={index === selected_index ? 'slash-menu-item selected' : 'slash-menu-item'}
                  onMouseDown={ev => ev.preventDefault()}
                  onMouseEnter={() => onSelectIndex(index)}
                  onClick={() => onPick(command)}
                >
                  <span className="slash-menu-icon"><CommandIcon id={command.id} /></span>
                  <span className="slash-menu-label">{command.label}</span>
                  {command.suffix !== undefined && (
                    <span className="slash-menu-suffix">{command.suffix}</span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <div className="slash-menu-footer">
        <span>↑↓ 选择</span>
        <span>↵ 插入</span>
        <span>Esc 关闭</span>
      </div>
    </div>
  )
}
