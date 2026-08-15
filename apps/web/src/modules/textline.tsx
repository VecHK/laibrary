import { useEffect, useRef, useState } from 'react'
import { Item } from '@laibrary/types'
import { getRpc } from '../lib/rpc'
import { orderAfter } from '../lib/order'
import type { ItemModule, ViewerCtx } from './types'

function useDebouncedSave(item: Item, ctx: ViewerCtx) {
  const [value, setValue] = useState(item.title)
  const timer_ref = useRef<ReturnType<typeof setTimeout> | null>(null)
  const value_ref = useRef(item.title)

  useEffect(() => {
    value_ref.current = value
  }, [value])

  useEffect(() => {
    setValue(item.title)
    value_ref.current = item.title
  }, [item.title, item.id])

  const scheduleSave = (new_value: string) => {
    setValue(new_value)
    value_ref.current = new_value
    if (timer_ref.current !== null) {
      clearTimeout(timer_ref.current)
    }
    timer_ref.current = setTimeout(() => {
      getRpc().updateItem({
        id: item.id,
        data: { title: value_ref.current },
      }).catch(err => {
        ctx.showError(err instanceof Error ? err.message : String(err))
      })
    }, 400)
  }

  return [value, scheduleSave] as const
}

export function TextLineRow({
  item,
  siblings,
  ctx,
  refresh,
}: {
  item: Item
  siblings: Item[]
  ctx: ViewerCtx
  refresh: () => void
}) {
  const [value, scheduleSave] = useDebouncedSave(item, ctx)

  const idx = siblings.findIndex(s => s.id === item.id)
  const prev = idx > 0 ? siblings[idx - 1] : undefined
  const next = idx !== -1 && idx < siblings.length - 1 ? siblings[idx + 1] : undefined

  const insertAfter = () => {
    const order = orderAfter(item.order_index, next?.order_index)
    getRpc().addItem({
      role: 'textline',
      title: '',
      parent_id: item.parent_id,
      order_index: order,
    }).then(() => refresh()).catch(err => {
      ctx.showError(err instanceof Error ? err.message : String(err))
    })
  }

  const removeSelf = () => {
    getRpc().deleteItem({ id: item.id }).then(() => refresh()).catch(err => {
      ctx.showError(err instanceof Error ? err.message : String(err))
    })
  }

  const swapWith = (other: Item) => {
    const cur_order = item.order_index
    const other_order = other.order_index
    Promise.all([
      getRpc().updateItem({ id: item.id, data: { order_index: other_order } }),
      getRpc().updateItem({ id: other.id, data: { order_index: cur_order } }),
    ]).then(() => refresh()).catch(err => {
      ctx.showError(err instanceof Error ? err.message : String(err))
    })
  }

  return (
    <div className="textline-row">
      <input
        className="textline-input"
        value={value}
        placeholder="输入文本"
        onChange={ev => scheduleSave(ev.target.value)}
        onKeyDown={ev => {
          if (ev.key === 'Enter') {
            ev.preventDefault()
            insertAfter()
          } else if (ev.key === 'Backspace' && value.length === 0) {
            ev.preventDefault()
            removeSelf()
          }
        }}
      />
      <span className="textline-tools">
        <button
          className="tool-button"
          title="上移"
          disabled={prev === undefined}
          onClick={() => prev && swapWith(prev)}
        >↑</button>
        <button
          className="tool-button"
          title="下移"
          disabled={next === undefined}
          onClick={() => next && swapWith(next)}
        >↓</button>
      </span>
    </div>
  )
}

function TextLineCard({ item }: { item: Item }) {
  return <span className="textline-card">{item.title || '(空行)'}</span>
}

function TextLineFull({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  const [value, scheduleSave] = useDebouncedSave(item, ctx)
  return (
    <div className="panel">
      <input
        className="big-input"
        value={value}
        onChange={ev => scheduleSave(ev.target.value)}
      />
    </div>
  )
}

export const textlineModule: ItemModule = {
  role: 'textline',
  Presenter: {
    card: (item) => <TextLineCard item={item} />,
    full: (item, ctx) => <TextLineFull item={item} ctx={ctx} />,
  },
}
