import { useEffect, useState } from 'react'
import type { Item } from '@laibrary/types'
import { getRpc } from '../lib/rpc'

export function ItemPicker({
  onSelect,
  onClose,
}: {
  onSelect: (item: Item) => void
  onClose: () => void
}) {
  const [items, setItems] = useState<Item[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)

  const load = (text: string) => {
    setLoading(true)
    getRpc().listing({
      limit: 50,
      sort_by: 'update_date',
      desc: true,
      filter_rules: text.trim().length === 0
        ? []
        : [{ name: 'title', input: text.trim(), logic: 'and' }],
    }).then(setItems).finally(() => setLoading(false))
  }

  useEffect(() => {
    load('')
  }, [])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={ev => ev.stopPropagation()}>
        <div className="modal-title">选择要链接的 Item</div>
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
          {loading && <div className="loading">加载中…</div>}
          {!loading && items.length === 0 && <div className="empty-hint">没有结果</div>}
          {items.map(item => (
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
