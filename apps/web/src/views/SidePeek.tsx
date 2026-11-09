import { useEffect } from 'react'
import type { ItemID } from '@laibrary/types'
import type { ViewerCtx } from '../modules/types'
import { ItemView } from './ItemView'

export function SidePeek({
  item_id,
  ctx,
  refresh_key,
  on_close,
}: {
  item_id: ItemID
  ctx: ViewerCtx
  refresh_key: number
  on_close: () => void
}) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !event.defaultPrevented) {
        on_close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [on_close])

  return (
    <aside className="side-peek">
      <div className="side-peek-header">
        <span>Side peek</span>
        <button
          type="button"
          className="side-peek-close"
          aria-label="关闭侧边预览"
          onClick={on_close}
        >×</button>
      </div>
      <div className="side-peek-body">
        <ItemView item_id={item_id} ctx={ctx} refresh_key={refresh_key} />
      </div>
    </aside>
  )
}
