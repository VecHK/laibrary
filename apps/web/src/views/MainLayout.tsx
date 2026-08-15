import { useCallback, useEffect, useState } from 'react'
import { Item } from '@laibrary/types'
import { getRpc } from '../lib/rpc'
import { loadTags, tagsLoaded } from '../lib/tags'
import type { ViewerCtx } from '../modules/types'
import type { HashRoute } from '../lib/hash-router'
import { ItemView } from './ItemView'
import { PlazaView } from './PlazaView'

export function MainLayout({
  route,
  ctx,
  refresh_key,
  onOpenSettings,
}: {
  route: HashRoute
  ctx: ViewerCtx
  refresh_key: number
  onOpenSettings: () => void
}) {
  const [root_items, setRootItems] = useState<Item[]>([])

  const loadRoots = useCallback(() => {
    getRpc().listing({
      limit: 0,
      sort_by: 'order_index',
      filter_rules: [
        { name: 'parent', input: null, logic: 'and' },
        { name: 'role', input: ['custom', 'database'], logic: 'and' },
      ],
    }).then(setRootItems).catch(err => {
      ctx.showError(err instanceof Error ? err.message : String(err))
    })
  }, [])

  useEffect(loadRoots, [loadRoots, refresh_key])

  const createPage = () => {
    getRpc().addItem({ role: 'custom', title: '新页面' })
      .then(item => {
        ctx.refresh()
        ctx.navigate(item.id)
      }).catch(err => {
        ctx.showError(err instanceof Error ? err.message : String(err))
      })
  }

  const createDatabase = () => {
    getRpc().addItem({
      role: 'database',
      title: '新数据库',
      attributes: { schema: [] },
    })
      .then(item => {
        ctx.refresh()
        ctx.navigate(item.id)
      }).catch(err => {
        ctx.showError(err instanceof Error ? err.message : String(err))
      })
  }

  const createTag = () => {
    const title = window.prompt('tag 名')
    if (title && title.trim().length > 0) {
      getRpc().newTag({ title: title.trim() })
        .then(() => {
          loadTags().then(() => ctx.refresh()).catch(() => {})
        }).catch(err => {
          ctx.showError(err instanceof Error ? err.message : String(err))
        })
    }
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-title">Laibrary</div>
        <div className="sidebar-section">
          <button
            className={route.name === 'plaza' ? 'side-button active' : 'side-button'}
            onClick={() => ctx.navigate({ name: 'plaza' })}
          >🧭 广场</button>
        </div>
        <div className="sidebar-section">
          <div className="sidebar-label">根条目</div>
          {root_items.map(item => (
            <button
              key={item.id}
              className={route.name === 'item' && route.id === item.id ? 'side-button active' : 'side-button'}
              onClick={() => ctx.navigate(item.id)}
            >
              {item.role === 'database' ? '🗄️' : '📄'} {item.title || '(无标题)'}
            </button>
          ))}
        </div>
        <div className="sidebar-section sidebar-actions">
          <button className="side-button" onClick={createPage}>＋ 新页面</button>
          <button className="side-button" onClick={createDatabase}>＋ 新数据库</button>
          <button className="side-button" onClick={createTag}>＋ 新标签</button>
          <button className="side-button" onClick={onOpenSettings}>⚙ 连接设置</button>
        </div>
      </aside>

      <main className="main">
        {!tagsLoaded() ? (
          <div className="loading">加载中…</div>
        ) : (
          route.name === 'plaza' ? <PlazaView ctx={ctx} /> : (
            route.name === 'item' ? (
              <ItemView item_id={route.id} ctx={ctx} refresh_key={refresh_key} />
            ) : null
          )
        )}
      </main>
    </div>
  )
}
