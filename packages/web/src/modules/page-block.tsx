import { useRef, useState, type ReactNode } from 'react'
import type { Item, ItemID } from '@laibrary/types'
import { zItemID } from '@laibrary/types'
import { BlockMenu } from './block-menu'

export function PageBlock({
  item,
  content,
  can_duplicate,
  can_delete,
  can_move_up,
  can_move_down,
  onDropBlock,
  onDragOverBlock,
  onDragLeaveBlock,
  onDragEndBlock,
  drop_position,
  drag_anywhere,
  selected,
  onSelect,
  onDuplicate,
  onMove,
  onDelete,
  onAddAfter,
}: {
  item: Item
  content: ReactNode
  can_duplicate: boolean
  can_delete: boolean
  can_move_up: boolean
  can_move_down: boolean
  onDropBlock: (dragged_id: ItemID, target_id: ItemID, position: 'before' | 'after') => void
  onDragOverBlock: (position: 'before' | 'after') => void
  onDragLeaveBlock: () => void
  onDragEndBlock: () => void
  drop_position: 'before' | 'after' | null
  drag_anywhere: boolean
  selected: boolean
  onSelect: () => void
  onDuplicate: () => void
  onMove: (direction: 'up' | 'down') => void
  onDelete: () => void
  onAddAfter: () => void
}) {
  const [menu_open, setMenuOpen] = useState(false)
  const $drag_started_ref = useRef(false)

  return (
    <div
      data-block-id={String(item.id)}
      className={[
        'page-block',
        selected ? 'selected' : '',
        menu_open ? 'menu-open' : '',
        drop_position === 'before' ? 'drop-before' : '',
        drop_position === 'after' ? 'drop-after' : '',
      ].filter(part => part.length !== 0).join(' ')}
      draggable={drag_anywhere}
      onDragStart={ev => {
        if (drag_anywhere) {
          const target = ev.target
          if (target instanceof Element && target.closest('.block-drag-handle') !== null) {
            // 六点把手有自己的 dragstart。
          } else if (target instanceof Element && target.closest('button, input, textarea, a, .image-resizer, .image-toolbar, .block-caption, .image-caption-wrap') !== null) {
            ev.preventDefault()
          } else {
            $drag_started_ref.current = true
            ev.dataTransfer.setData('text/laibrary-block', String(item.id))
            ev.dataTransfer.effectAllowed = 'move'
          }
        }
      }}
      onDragOver={ev => {
        const has_files = ev.dataTransfer.types.includes('Files')
        const has_block = ev.dataTransfer.types.includes('text/laibrary-block')
        const has_text = ev.dataTransfer.types.includes('text/plain') && !has_block
        if (has_files || has_text) {
          ev.preventDefault()
          ev.dataTransfer.dropEffect = 'copy'
          const rect = ev.currentTarget.getBoundingClientRect()
          onDragOverBlock(ev.clientY < rect.top + rect.height / 2 ? 'before' : 'after')
        } else {
          ev.preventDefault()
          ev.dataTransfer.dropEffect = 'move'
          const rect = ev.currentTarget.getBoundingClientRect()
          onDragOverBlock(ev.clientY < rect.top + rect.height / 2 ? 'before' : 'after')
        }
      }}
      onDragLeave={ev => {
        if (ev.relatedTarget instanceof Node && ev.currentTarget.contains(ev.relatedTarget)) {
          // 只是在 block 内部移动，不清除指示器。
        } else {
          onDragLeaveBlock()
        }
      }}
      onDragEnd={() => {
        window.setTimeout(() => {
          $drag_started_ref.current = false
        }, 0)
        onDragEndBlock()
      }}
      onDrop={ev => {
        const has_block = ev.dataTransfer.types.includes('text/laibrary-block')
        const has_text = ev.dataTransfer.types.includes('text/plain')
        if (ev.dataTransfer.types.includes('Files') || (has_text && !has_block)) {
          // 文件和外部文本交给 PageFull 统一处理。
        } else if (has_block) {
          ev.preventDefault()
          const dragged = zItemID.safeParse(Number(ev.dataTransfer.getData('text/laibrary-block')))
          const rect = ev.currentTarget.getBoundingClientRect()
          const position = ev.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
          if (dragged.success && dragged.data !== item.id) {
            onDropBlock(dragged.data, item.id, position)
          } else {
            onDragEndBlock()
          }
        } else {
          ev.preventDefault()
        }
      }}
    >
      <span className="block-gutter">
        <button
          className="block-add"
          title="在下方插入文本行"
          aria-label="在下方插入文本行"
          onClick={ev => {
            ev.stopPropagation()
            setMenuOpen(false)
            onAddAfter()
          }}
        >＋</button>
        <span
          className="block-drag-handle"
          title="拖动排序 / 点击打开菜单"
          role="button"
          tabIndex={0}
          draggable
          onDragStart={ev => {
            $drag_started_ref.current = true
            ev.dataTransfer.setData('text/laibrary-block', String(item.id))
            ev.dataTransfer.effectAllowed = 'move'
          }}
          onDragEnd={() => {
            window.setTimeout(() => {
              $drag_started_ref.current = false
            }, 0)
            onDragEndBlock()
          }}
          onClick={ev => {
            ev.stopPropagation()
            onSelect()
            if (!$drag_started_ref.current) {
              setMenuOpen(value => !value)
            }
          }}
          onKeyDown={ev => {
            if (ev.key === 'Enter' || ev.key === ' ') {
              ev.preventDefault()
              setMenuOpen(value => !value)
            }
          }}
        >
          <span className="block-handle-dots" aria-hidden="true">
            <svg viewBox="0 0 10 16">
              <circle cx="3" cy="3" r="1.25" />
              <circle cx="7" cy="3" r="1.25" />
              <circle cx="3" cy="8" r="1.25" />
              <circle cx="7" cy="8" r="1.25" />
              <circle cx="3" cy="13" r="1.25" />
              <circle cx="7" cy="13" r="1.25" />
            </svg>
          </span>
          <span className="block-handle-tooltip">
            拖动排序<br />点击打开菜单
          </span>
        </span>
      </span>
      <div className="page-block-content">
        {content}
      </div>
      {menu_open && (
        <BlockMenu
          can_duplicate={can_duplicate}
          can_delete={can_delete}
          can_move_up={can_move_up}
          can_move_down={can_move_down}
          on_duplicate={() => {
            setMenuOpen(false)
            onDuplicate()
          }}
          on_move_up={() => {
            setMenuOpen(false)
            onMove('up')
          }}
          on_move_down={() => {
            setMenuOpen(false)
            onMove('down')
          }}
          on_delete={() => {
            setMenuOpen(false)
            onDelete()
          }}
          on_close={() => setMenuOpen(false)}
        />
      )}
    </div>
  )
}
