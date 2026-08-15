import { useEffect, useRef, useState } from 'react'
import { Item } from '@laibrary/types'
import { getRpc } from '../lib/rpc'
import type { ItemModule, ViewerCtx } from './types'
import { resolveModule } from './registry'
import { TextLineRow } from './textline'
import { uploadImageFile } from './helpers'

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

function PageCard({ item }: { item: Item }) {
  return (
    <div className="card page-card">
      <div className="card-icon">📄</div>
      <div className="card-title">{item.title || '(无标题)'}</div>
    </div>
  )
}

function PageFull({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  const [children, setChildren] = useState<Item[] | null>(null)
  const [value, scheduleSave] = useDebouncedTitle(item, ctx)
  const file_input_ref = useRef<HTMLInputElement>(null)

  const loadChildren = () => {
    getRpc().listing({
      limit: 0,
      sort_by: 'order_index',
      filter_rules: [{ name: 'parent', input: item.id, logic: 'and' }],
    }).then(setChildren).catch(err => {
      ctx.showError(err instanceof Error ? err.message : String(err))
    })
  }

  useEffect(loadChildren, [item.id])

  const refresh = () => {
    loadChildren()
    ctx.refresh()
  }

  const appendTextLine = () => {
    const last_order = children?.[children.length - 1]?.order_index ?? 0
    getRpc().addItem({
      role: 'textline',
      title: '',
      parent_id: item.id,
      order_index: last_order + 1,
    }).then(() => refresh()).catch(err => {
      ctx.showError(err instanceof Error ? err.message : String(err))
    })
  }

  return (
    <div className="page-full">
      <input
        className="page-title-input"
        value={value}
        placeholder="无标题"
        onChange={ev => scheduleSave(ev.target.value)}
      />

      <div className="page-toolbar">
        <button className="button" onClick={appendTextLine}>+ 文本行</button>
        <button className="button" onClick={() => file_input_ref.current?.click()}>+ 图片</button>
        <input
          ref={file_input_ref}
          type="file"
          accept="image/*"
          hidden
          onChange={ev => {
            const file = ev.target.files?.[0]
            if (file) {
              uploadImageFile(file, item.id, refresh, ctx.showError)
            }
            ev.target.value = ''
          }}
        />
      </div>

      <div className="children-list">
        {children === null ? <div className="loading">加载中…</div> : children.map(child => {
          if (child.role === 'textline') {
            return (
              <TextLineRow
                key={child.id}
                item={child}
                siblings={children}
                ctx={ctx}
                refresh={refresh}
              />
            )
          } else {
            const module = resolveModule(child)
            return (
              <div
                key={child.id}
                className="child-card"
                onClick={() => ctx.navigate(child.id)}
              >
                {module.Presenter.card(child, ctx)}
              </div>
            )
          }
        })}
        {children !== null && children.length === 0 && (
          <div className="empty-hint">没有内容。添加一行文本或一张图片。</div>
        )}
      </div>
    </div>
  )
}

export const pageModule: ItemModule = {
  Presenter: {
    card: (item) => <PageCard item={item} />,
    full: (item, ctx) => <PageFull item={item} ctx={ctx} />,
  },
}
