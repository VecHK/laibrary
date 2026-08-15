import { useEffect, useState } from 'react'
import { Item, Role } from '@laibrary/types'
import { getRpc } from '../lib/rpc'
import { resolveModule } from '../modules/registry'
import type { ViewerCtx } from '../modules/types'

const FILTERS: Array<{ name: string; roles: Role[] | 'all' }> = [
  { name: '全部', roles: ['custom', 'textline', 'image', 'file', 'database'] },
  { name: '页面', roles: ['custom'] },
  { name: '图片', roles: ['image'] },
  { name: '文件', roles: ['file'] },
  { name: '数据库', roles: ['database'] },
  { name: '标签', roles: ['tag'] },
]

export function PlazaView({ ctx }: { ctx: ViewerCtx }) {
  const [items, setItems] = useState<Item[]>([])
  const [filter_idx, setFilterIdx] = useState(0)
  const [loaded_all, setLoadedAll] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadFirstPage = () => {
    const filter = FILTERS[filter_idx]
    const rules = (
      filter !== undefined && filter.roles !== 'all'
    ) ? [{ name: 'role' as const, input: filter.roles, logic: 'and' as const }] : []

    setLoading(true)
    getRpc().listing({
      limit: 50,
      sort_by: 'update_date',
      desc: true,
      filter_rules: rules,
    }).then(page => {
      setItems(page)
      setLoadedAll(page.length < 50)
    }).catch(err => {
      ctx.showError(err instanceof Error ? err.message : String(err))
    }).finally(() => setLoading(false))
  }

  useEffect(loadFirstPage, [filter_idx])

  const loadMore = () => {
    if (items.length === 0) {
      return
    }
    const filter = FILTERS[filter_idx]
    const rules = (
      filter !== undefined && filter.roles !== 'all'
    ) ? [{ name: 'role' as const, input: filter.roles, logic: 'and' as const }] : []

    setLoading(true)
    getRpc().listing({
      limit: 50,
      sort_by: 'update_date',
      desc: true,
      after_id: items[items.length - 1]!.id,
      filter_rules: rules,
    }).then(page => {
      setItems(prev => [...prev, ...page])
      setLoadedAll(page.length < 50)
    }).catch(err => {
      ctx.showError(err instanceof Error ? err.message : String(err))
    }).finally(() => setLoading(false))
  }

  return (
    <div className="plaza">
      <div className="filter-bar">
        {FILTERS.map((filter, idx) => (
          <button
            key={filter.name}
            className={idx === filter_idx ? 'chip active' : 'chip'}
            onClick={() => {
              setItems([])
              setFilterIdx(idx)
            }}
          >{filter.name}</button>
        ))}
      </div>

      <div className="card-grid">
        {items.map(item => (
          <div key={item.id} onClick={() => ctx.navigate(item.id)}>
            {resolveModule(item).Presenter.card(item, ctx)}
          </div>
        ))}
      </div>

      {!loaded_all && !loading && items.length !== 0 && (
        <div className="load-more">
          <button className="button" onClick={loadMore}>加载更多</button>
        </div>
      )}
      {loading && <div className="loading">加载中…</div>}
      {!loading && items.length === 0 && (
        <div className="empty-hint">空空如也。</div>
      )}
    </div>
  )
}
