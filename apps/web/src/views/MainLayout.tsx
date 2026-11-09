import { useState } from 'react'
import type { ItemID } from '@laibrary/types'
import type { ViewerCtx } from '../modules/types'
import type { HashRoute } from '../lib/hash-router'
import { ItemView } from './ItemView'
import { PlazaView } from './PlazaView'
import { SettingsView } from './SettingsView'
import { Sidebar } from './Sidebar'
import { SidePeek } from './SidePeek'

export function MainLayout({
  route,
  ctx,
  refresh_key,
  sidebar_key,
}: {
  route: HashRoute
  ctx: ViewerCtx
  refresh_key: number
  sidebar_key: number
}) {
  const [peek_id, setPeekId] = useState<ItemID | null>(null)

  return (
    <div className="layout">
      <Sidebar
        route={route}
        ctx={ctx}
        refresh_key={sidebar_key}
        onOpenPeek={setPeekId}
      />
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
      {peek_id !== null && (
        <SidePeek
          item_id={peek_id}
          ctx={ctx}
          refresh_key={refresh_key}
          on_close={() => setPeekId(null)}
        />
      )}
    </div>
  )
}
