import type { Item } from '@laibrary/types'
import type { ItemModule, ViewerCtx } from './types'
import { getKindModule } from '../lib/kind-registry'
import { openItem } from '../lib/open-item'

function EntityFallbackBlock({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  return (
    <div
      className="block-entity is-unknown"
      onClick={() => {
        ctx.showError('没有合适的打开方式')
      }}
    >
      <span className="block-entity-icon">❓</span>
      <span className="block-entity-name">{item.title || '(无标题)'}</span>
      <span className="block-entity-meta">未知类型: {item.kind ?? '(无 kind)'}</span>
    </div>
  )
}

function EntityBlock({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  const module = item.kind === null ? undefined : getKindModule(item.kind)
  if (module?.inlineIcon === undefined) {
    return <EntityFallbackBlock item={item} ctx={ctx} />
  }
  return (
    <div
      className="block-entity"
      onClick={() => openItem(item, ctx)}
    >
      <span className="block-entity-icon">{module.inlineIcon(item, ctx)}</span>
      <span className="block-entity-name">{item.title || `(${module.kind})`}</span>
      <span className="block-entity-meta">
        {module.inlineMeta?.(item, ctx) ?? module.kind}
      </span>
    </div>
  )
}

function EntityCard({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  const module = item.kind === null ? undefined : getKindModule(item.kind)
  if (module !== undefined) {return <>{module.Presenter.card(item, ctx)}</>}
  return (
    <div className="card entity-card">
      <div className="card-icon">❓</div>
      <div className="card-title">{item.title || '(未知内容)'}</div>
      <div className="card-sub">{item.kind ?? '无 kind'}</div>
    </div>
  )
}

function EntityFull({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  const module = item.kind === null ? undefined : getKindModule(item.kind)
  if (module !== undefined) {return <>{module.Presenter.full(item, ctx)}</>}
  return (
    <div className="panel">
      <div className="panel-title">没有合适的打开方式</div>
      <p className="empty-hint">kind: {item.kind ?? '(无)'}</p>
    </div>
  )
}

export const entityModule: ItemModule = {
  role: 'entity',
  Presenter: {
    card: (item, ctx) => <EntityCard item={item} ctx={ctx} />,
    full: (item, ctx) => <EntityFull item={item} ctx={ctx} />,
  },
  Block: (item, ctx) => <EntityBlock item={item} ctx={ctx} />,
}
