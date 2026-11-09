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
  onDropBlock: (dragged_id: ItemID, target_id: ItemID) => void
  onDuplicate: () => void
  onMove: (direction: 'up' | 'down') => void
  onDelete: () => void
  onAddAfter: () => void
}) {
  const [menu_open, setMenuOpen] = useState(false)
  const drag_started_ref = useRef(false)

  return (
    <div
      className={menu_open ? 'page-block menu-open' : 'page-block'}
      onDragOver={ev => {
        ev.preventDefault()
        ev.dataTransfer.dropEffect = 'move'
      }}
      onDrop={ev => {
        ev.preventDefault()
        const dragged = zItemID.safeParse(Number(ev.dataTransfer.getData('text/laibrary-block')))
        if (dragged.success && dragged.data !== item.id) {
          onDropBlock(dragged.data, item.id)
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
            drag_started_ref.current = true
            ev.dataTransfer.setData('text/laibrary-block', String(item.id))
            ev.dataTransfer.effectAllowed = 'move'
          }}
          onDragEnd={() => {
            window.setTimeout(() => {
              drag_started_ref.current = false
            }, 0)
          }}
          onClick={ev => {
            ev.stopPropagation()
            if (!drag_started_ref.current) {
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
