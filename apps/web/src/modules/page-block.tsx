import type { ReactNode } from 'react'
import type { Item, ItemID } from '@laibrary/types'
import { zItemID } from '@laibrary/types'

export function PageBlock({
  item,
  content,
  onDropBlock,
  onDelete,
  onAddAfter,
}: {
  item: Item
  content: ReactNode
  onDropBlock: (dragged_id: ItemID, target_id: ItemID) => void
  onDelete: () => void
  onAddAfter: () => void
}) {
  return (
    <div
      className="page-block"
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
        <span
          className="block-drag-handle"
          title="拖拽排序"
          draggable
          onDragStart={ev => {
            ev.dataTransfer.setData('text/laibrary-block', String(item.id))
            ev.dataTransfer.effectAllowed = 'move'
          }}
        >⠿</span>
        <button
          className="block-add"
          title="在下方插入文本行"
          onClick={ev => {
            ev.stopPropagation()
            onAddAfter()
          }}
        >＋</button>
      </span>
      <div className="page-block-content">
        {content}
      </div>
      <button
        className="tool-button block-delete"
        title="删除 block"
        onClick={ev => {
          ev.stopPropagation()
          onDelete()
        }}
      >✕</button>
    </div>
  )
}
