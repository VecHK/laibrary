import { useCallback, useEffect, useState } from 'react'
import type { Item } from '@laibrary/types'
import type { ViewerCtx } from '../modules/types'
import type { HashRoute } from '../lib/hash-router'
import { ItemView } from './ItemView'
import { PlazaView } from './PlazaView'
import { SettingsView } from './SettingsView'

export function MainLayout({
  route,
  ctx,
  refresh_key,
}: {
  route: HashRoute
  ctx: ViewerCtx
  refresh_key: number
}) {
  const [root_items, setRootItems] = useState<Item[]>([])

  const loadRoots = useCallback(() => {
    ctx.api.rpc.listing({
      limit: 200,
      sort_by: 'order_index',
      filter_rules: [
        { name: 'parent', input: null, logic: 'and' },
        { name: 'role', input: ['page', 'database', 'entity'], logic: 'and' },
      ],
    }).then(setRootItems).catch(err => {
      ctx.showError(err instanceof Error ? err.message : String(err))
    })
  }, [])

  useEffect(loadRoots, [loadRoots, refresh_key])


  const createPage = async () => {
    try {
      const page = await ctx.api.rpc.addItem({ role: 'page', title: '新页面' })
      await ctx.api.rpc.addItem({
        role: 'textline',
        title: '',
        parent_id: page.id,
        order_index: 1,
      })
      ctx.refresh()
      ctx.navigate(page.id)
    } catch (err) {
      ctx.showError(err instanceof Error ? err.message : String(err))
    }
  }

  const createDatabase = () => {
    ctx.api.rpc.addItem({
      role: 'database',
      title: '新数据库',
      attributes: { schema: [] },
    }).then(item => {
      ctx.refresh()
      ctx.navigate(item.id)
    }).catch(err => ctx.showError(err instanceof Error ? err.message : String(err)))
  }

  const createManga = async () => {
    let reading_direction = 'rtl'
    try {
      const config = await ctx.api.rpc.getConfig()
      const entry = config.entries.find(item => item.key === 'sys.config.manga_default_direction')
      if (entry?.value === 'ltr' || entry?.value === 'rtl') {
        reading_direction = entry.value
      }
    } catch (error) {
      console.warn('manga direction config fallback', error)
    }
    ctx.api.rpc.addItem({
      role: 'entity',
      kind: 'manga',
      title: '新漫画',
      attributes: { reading_direction },
    }).then(item => {
      ctx.refresh()
      ctx.navigate(item.id)
    }).catch(err => ctx.showError(err instanceof Error ? err.message : String(err)))
  }

  const createTag = () => {
    const title = window.prompt('tag 名')
    if (title && title.trim().length > 0) {
      ctx.api.rpc.newTag({ title: title.trim() })
        .then(() => ctx.tags.load().then(() => ctx.refresh()))
        .catch(err => ctx.showError(err instanceof Error ? err.message : String(err)))
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
              {item.role === 'database' ? '🗄️' : item.role === 'entity' ? '📖' : '📄'} {item.title || '(无标题)'}
            </button>
          ))}
        </div>
        <div className="sidebar-section sidebar-actions">
          <button className="side-button" onClick={createPage}>＋ 新页面</button>
          <button className="side-button" onClick={createDatabase}>＋ 新数据库</button>
          <button className="side-button" onClick={createManga}>＋ 新漫画</button>
          <button className="side-button" onClick={createTag}>＋ 新标签</button>
          <button className="side-button" onClick={() => ctx.navigate({ name: 'settings' })}>⚙ 设置</button>
        </div>
      </aside>

      <main className="main">
        {!ctx.tags.isLoaded() ? (
          <div className="loading">加载中…</div>
        ) : route.name === 'settings' ? (
          <SettingsView ctx={ctx} />
        ) : route.name === 'plaza' ? (
          <PlazaView ctx={ctx} />
        ) : route.name === 'item' ? (
          <ItemView item_id={route.id} ctx={ctx} refresh_key={refresh_key} />
        ) : null}
      </main>
    </div>
  )
}
