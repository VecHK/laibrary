import { useEffect, useState } from 'react'
import type { FilterRule, Item, Role } from '@laibrary/types'
import { getRpc } from '../lib/rpc'
import { resolveModule } from '../modules/registry'
import { openItem } from '../lib/open-item'
import type { ViewerCtx } from '../modules/types'

type Filter = {
  name: string
  roles?: Role[]
  kind?: string
}

const FILTERS: Filter[] = [
  { name: '全部', roles: ['page', 'entity', 'textline', 'image', 'file', 'database'] },
  { name: '页面', roles: ['page'] },
  { name: '漫画', kind: 'manga' },
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
  const [page_size, setPageSize] = useState(50)

  const buildRules = (filter: Filter | undefined): FilterRule[] => {
    if (filter === undefined) {return []}
    const rules: FilterRule[] = []
    if (filter.roles !== undefined) {
      rules.push({ name: 'role', input: filter.roles, logic: 'and' })
    }
    if (filter.kind !== undefined) {
      rules.push({ name: 'kind', input: filter.kind, logic: 'and' })
    }
    return rules
  }

  const loadFirstPage = () => {
    const filter = FILTERS[filter_idx]
    setLoading(true)
    getRpc().listing({
      limit: page_size,
      sort_by: 'update_date',
      desc: true,
      filter_rules: buildRules(filter),
    }).then(page => {
      setItems(page)
      setLoadedAll(page.length < page_size)
    }).catch(err => ctx.showError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    getRpc().getConfig(undefined).then(snapshot => {
      const entry = snapshot.entries.find(item => item.key === 'sys.config.ui_page_size')
      if (typeof entry?.value === 'number' && entry.value > 0) {
        setPageSize(Math.min(200, entry.value))
      }
    }).catch(() => undefined)
  }, [])

  useEffect(loadFirstPage, [filter_idx, page_size])

  const loadMore = () => {
    const last_item = items[items.length - 1]
    if (last_item === undefined) {return}
    const filter = FILTERS[filter_idx]
    setLoading(true)
    getRpc().listing({
      limit: page_size,
      sort_by: 'update_date',
      desc: true,
      after_id: last_item.id,
      filter_rules: buildRules(filter),
    }).then(page => {
      setItems(prev => [...prev, ...page])
      setLoadedAll(page.length < page_size)
    }).catch(err => ctx.showError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
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
          <div key={item.id} onClick={() => { void openItem(item, ctx) }}>
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
      {!loading && items.length === 0 && <div className="empty-hint">空空如也。</div>}
    </div>
  )
}
