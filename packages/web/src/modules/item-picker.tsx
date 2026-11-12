import { useEffect, useState } from 'react'
import type { FilterRule, Item, Role } from '@laibrary/types'
import type { ViewerCtx } from './types'

export function ItemPicker({
  onSelect,
  onClose,
  exclude_ids,
  ctx,
  title = '选择要链接的 Item',
  roles,
  allow_root = false,
  onSelectRoot,
}: {
  onSelect: (item: Item) => void
  onClose: () => void
  exclude_ids?: readonly Item['id'][]
  ctx: ViewerCtx
  title?: string
  roles?: readonly Role[]
  allow_root?: boolean
  onSelectRoot?: () => void
}) {
  const [items, setItems] = useState<Item[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)

  const load = (text: string) => {
    setLoading(true)
    const filter_rules: FilterRule[] = []
    if (text.trim().length !== 0) {
      filter_rules.push({ name: 'title', input: text.trim(), logic: 'and' })
    }
    if (roles !== undefined) {
      filter_rules.push({ name: 'role', input: [...roles], logic: 'and' })
    }
    ctx.api.rpc.listing({
      limit: 50,
      sort_by: 'update_date',
      desc: true,
      filter_rules,
    }).then(setItems).catch(error => {
      ctx.showError(error instanceof Error ? error.message : String(error))
    }).finally(() => setLoading(false))
  }

  useEffect(() => {
    load('')
  }, [])

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {onClose()}
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const visible_items = items.filter(item => !exclude_ids?.includes(item.id))

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={ev => ev.stopPropagation()}>
        <div className="modal-title">{title}</div>
        <input
          className="big-input"
          autoFocus
          value={query}
          placeholder="搜索标题"
          onChange={ev => {
            setQuery(ev.target.value)
            load(ev.target.value)
          }}
        />
        <div className="picker-list">
          {allow_root && (
            <button
              className="picker-row picker-root"
              onClick={() => {
                onSelectRoot?.()
                onClose()
              }}
            >
              <span className="picker-role">root</span>
              <span className="picker-title">根目录</span>
            </button>
          )}
          {loading && <div className="loading">加载中…</div>}
          {!loading && visible_items.length === 0 && <div className="empty-hint">没有结果</div>}
          {visible_items.map(item => (
            <button
              key={item.id}
              className="picker-row"
              onClick={() => {
                onSelect(item)
                onClose()
              }}
            >
              <span className="picker-role">{item.role}</span>
              <span className="picker-title">{item.title || '(无标题)'}</span>
              <span className="picker-id">#{item.id}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
