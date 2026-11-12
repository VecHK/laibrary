import type { Item } from '@laibrary/types'
import { ItemIcon } from './item-icon'
import type { ViewerCtx } from './types'

export function PageCard({ item }: { item: Item }) {
  return (
    <div className="card page-card">
      <div className="card-icon"><ItemIcon item={item} /></div>
      <div className="card-title">{item.title || '(无标题)'}</div>
    </div>
  )
}

export function PageBlockLink({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  return (
    <div className="block-page-link" onClick={() => ctx.navigate(item.id)}>
      <ItemIcon item={item} />
      <span className="block-page-link-title">{item.title || '(无标题)'}</span>
    </div>
  )
}
