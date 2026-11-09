import { useEffect, useRef } from 'react'
import type { SlashCommand } from '../lib/textline-editor'

export function SlashMenu({
  commands,
  selected_index,
  query,
  placement,
  max_height,
  onSelectIndex,
  onPick,
}: {
  commands: SlashCommand[]
  selected_index: number
  query: string
  placement: 'up' | 'down'
  max_height: number
  onSelectIndex: (index: number) => void
  onPick: (command: SlashCommand) => void
}) {
  const list_ref = useRef<HTMLDivElement>(null)

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
      aria-label="插入 block"
      style={{ maxHeight: `${max_height}px` }}
    >
      <div className="slash-menu-header">
        <span>插入 block</span>
        {query.length > 0 && <span className="slash-menu-query">/{query}</span>}
      </div>
      {commands.length === 0 ? (
        <div className="slash-menu-empty">没有匹配的 block</div>
      ) : commands.map((command, index) => (
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
          <span className="slash-menu-icon">{command.icon}</span>
          <span className="slash-menu-copy">
            <span className="slash-menu-label">{command.label}</span>
            <span className="slash-menu-desc">{command.description}</span>
          </span>
          <span className="slash-menu-role">{command.role}</span>
        </button>
      ))}
    </div>
  )
}
