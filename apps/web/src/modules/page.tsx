import { useEffect, useRef, useState } from 'react'
import type { Item } from '@laibrary/types'
import { getRpc } from '../lib/rpc'
import { createFileItem, createImageItem } from '../lib/blob'
import type { ItemModule, ViewerCtx } from './types'
import { resolveModule } from './registry'
import { ItemPicker } from './item-picker'

function useDebouncedTitle(item: Item, ctx: ViewerCtx) {
  const [value, setValue] = useState(item.title)
  const timer_ref = useRef<ReturnType<typeof setTimeout> | null>(null)
  const value_ref = useRef(item.title)

  useEffect(() => {
    setValue(item.title)
    value_ref.current = item.title
  }, [item.title, item.id])

  const scheduleSave = (new_value: string) => {
    setValue(new_value)
    value_ref.current = new_value
    if (timer_ref.current !== null) clearTimeout(timer_ref.current)
    timer_ref.current = setTimeout(() => {
      getRpc().updateItem({ id: item.id, data: { title: value_ref.current } })
        .catch(err => ctx.showError(err instanceof Error ? err.message : String(err)))
    }, 400)
  }

  return [value, scheduleSave] as const
}

function PageCard({ item }: { item: Item }) {
  return (
    <div className="card page-card">
      <div className="card-icon">📄</div>
      <div className="card-title">{item.title || '(无标题)'}</div>
    </div>
  )
}

function BlockWrapper({
  item,
  module,
  ctx,
  onDropBlock,
  onDelete,
}: {
  item: Item
  module: ItemModule
  ctx: ViewerCtx
  onDropBlock: (dragged_id: number, target_id: number) => void
  onDelete: () => void
}) {
  return (
    <div
      className="page-block"
      draggable
      onDragStart={ev => {
        ev.dataTransfer.setData('text/laibrary-block', String(item.id))
        ev.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={ev => {
        ev.preventDefault()
        ev.dataTransfer.dropEffect = 'move'
      }}
      onDrop={ev => {
        ev.preventDefault()
        const dragged = Number(ev.dataTransfer.getData('text/laibrary-block'))
        if (Number.isSafeInteger(dragged) && dragged !== item.id) {
          onDropBlock(dragged, item.id)
        }
      }}
    >
      <span className="block-drag-handle" title="拖拽排序">⠿</span>
      <div className="page-block-content">
        {module.Block !== undefined
          ? module.Block(item, ctx)
          : module.Presenter.card(item, ctx)}
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

function PageFull({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  const [children, setChildren] = useState<Item[] | null>(null)
  const [title, scheduleTitle] = useDebouncedTitle(item, ctx)
  const [picker, setPicker] = useState(false)
  const image_input_ref = useRef<HTMLInputElement>(null)
  const file_input_ref = useRef<HTMLInputElement>(null)

  const loadChildren = () => {
    getRpc().listing({
      limit: 0,
      sort_by: 'order_index',
      filter_rules: [{ name: 'parent', input: item.id, logic: 'and' }],
    }).then(setChildren)
      .catch(err => ctx.showError(err instanceof Error ? err.message : String(err)))
  }

  useEffect(loadChildren, [item.id])

  const refresh = () => {
    loadChildren()
    ctx.refresh()
  }

  const appendBlock = (form: Parameters<ReturnType<typeof getRpc>['addItem']>[0]) => {
    const last_order = children?.[children.length - 1]?.order_index ?? 0
    getRpc().addItem({ ...form, parent_id: item.id, order_index: last_order + 1 } as never)
      .then(refresh)
      .catch(err => ctx.showError(err instanceof Error ? err.message : String(err)))
  }

  const addText = () => appendBlock({ role: 'textline', title: '' })
  const addManga = () => appendBlock({ role: 'entity', kind: 'manga', title: '新漫画' })

  const deleteBlock = (block_id: number) => {
    getRpc().deleteItem({ id: block_id })
      .then(refresh)
      .catch(err => ctx.showError(err instanceof Error ? err.message : String(err)))
  }

  const handleDrop = (dragged_id: number, target_id: number) => {
    if (children === null) return
    const dragged = children.find(child => child.id === dragged_id)
    const target = children.find(child => child.id === target_id)
    if (dragged === undefined || target === undefined) return
    Promise.all([
      getRpc().updateItem({ id: dragged.id, data: { order_index: target.order_index } }),
      getRpc().updateItem({ id: target.id, data: { order_index: dragged.order_index } }),
    ]).then(refresh).catch(err => ctx.showError(err instanceof Error ? err.message : String(err)))
  }

  return (
    <div className="page-full">
      <input
        className="page-title-input"
        value={title}
        placeholder="无标题"
        onChange={ev => scheduleTitle(ev.target.value)}
      />

      <div className="page-toolbar">
        <button className="button" onClick={addText}>+ 文本行</button>
        <button className="button" onClick={() => image_input_ref.current?.click()}>+ 图片</button>
        <button className="button" onClick={() => file_input_ref.current?.click()}>+ 附件</button>
        <button className="button" onClick={() => setPicker(true)}>+ 链接</button>
        <button className="button" onClick={addManga}>+ 漫画</button>
        <input
          ref={image_input_ref}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={ev => {
            const files = [...(ev.target.files ?? [])]
            ev.target.value = ''
            ;(async () => {
              const last = children?.[children.length - 1]?.order_index ?? 0
              let offset = 0
              for (const file of files) {
                try {
                  const created = await createImageItem(file, item.id)
                  await getRpc().updateItem({
                    id: created.id,
                    data: { order_index: last + 1 + offset },
                  })
                  offset += 1
                } catch (err) {
                  ctx.showError(err instanceof Error ? err.message : String(err))
                }
              }
              refresh()
            })()
          }}
        />
        <input
          ref={file_input_ref}
          type="file"
          multiple
          hidden
          onChange={ev => {
            const files = [...(ev.target.files ?? [])]
            ev.target.value = ''
            ;(async () => {
              for (const file of files) {
                try {
                  await createFileItem(file, item.id)
                } catch (err) {
                  ctx.showError(err instanceof Error ? err.message : String(err))
                }
              }
              refresh()
            })()
          }}
        />
      </div>

      <div className="children-list">
        {children === null ? (
          <div className="loading">加载中…</div>
        ) : children.length === 0 ? (
          <div className="empty-hint">没有内容。添加文本、图片、附件、链接或漫画。</div>
        ) : children.map(child => {
          const module = resolveModule(child)
          return (
            <BlockWrapper
              key={child.id}
              item={child}
              module={module}
              ctx={ctx}
              onDropBlock={handleDrop}
              onDelete={() => deleteBlock(child.id)}
            />
          )
        })}
      </div>

      {picker && (
        <ItemPicker
          onClose={() => setPicker(false)}
          onSelect={target => {
            appendBlock({
              role: 'itemlink',
              title: target.title || `#${target.id}`,
              target_id: target.id,
            } as never)
          }}
        />
      )}
    </div>
  )
}

export const pageModule: ItemModule = {
  role: 'page',
  Presenter: {
    card: item => <PageCard item={item} />,
    full: (item, ctx) => <PageFull item={item} ctx={ctx} />,
  },
}
