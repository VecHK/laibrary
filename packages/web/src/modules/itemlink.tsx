import { useEffect, useState } from 'react'
import type { Item } from '@laibrary/types'
import { openItemById } from '../lib/open-item'
import type { ItemModule, ViewerCtx } from './types'
import { ItemIconButton } from './item-icon'

function useTarget(item: Item, ctx: ViewerCtx) {
  const [target, setTarget] = useState<Item | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    setTarget(null)
    setMissing(false)
    if (item.target_id === null) {
      setMissing(true)
    } else {
      ctx.api.rpc.getItem({ id: item.target_id })
        .then(setTarget)
        .catch(() => setMissing(true))
    }
  }, [item.id, item.target_id, ctx.api.rpc])

  return { target, missing }
}

function targetLabel(item: Item, target: Item | null, missing: boolean): string {
  if (missing) {
    return '链接失效'
  } else if (target === null) {
    return '加载中…'
  } else {
    return target.title || `#${target.id}`
  }
}

function ItemLinkBlock({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  const { target, missing } = useTarget(item, ctx)
  return (
    <div
      className={`block-link ${missing ? 'is-missing' : ''}`}
      onClick={() => {
        if (item.target_id !== null) {
          openItemById(item.target_id, ctx)
        } else {
          ctx.showError('链接目标不存在')
        }
      }}
    >
      <span className="block-link-icon">{missing ? '⚠️' : '🔗'}</span>
      <span className="block-link-name">{targetLabel(item, target, missing)}</span>
      <span className="block-link-kind">{target?.role ?? ''}</span>
    </div>
  )
}

function ItemLinkCard({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  const { target, missing } = useTarget(item, ctx)
  return (
    <div
      className="card link-card"
      onClick={() => {
        if (item.target_id !== null) {openItemById(item.target_id, ctx)}
      }}
    >
      <div className="card-icon">{missing ? '⚠️' : '🔗'}</div>
      <div className="card-title">{targetLabel(item, target, missing)}</div>
      <div className="card-sub">链接</div>
    </div>
  )
}

function ItemLinkFull({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  const { target, missing } = useTarget(item, ctx)
  const target_id = item.target_id
  return (
    <div className="panel">
      <div className="itemlink-header">
        <ItemIconButton item={item} ctx={ctx} />
        <div className="panel-title">链接</div>
      </div>
      <p className="empty-hint">{targetLabel(item, target, missing)}</p>
      {target_id !== null && (
        <button className="button" onClick={() => openItemById(target_id, ctx)}>
          打开目标
        </button>
      )}
    </div>
  )
}

export const __ITEMLINK_MODULE__: ItemModule = {
  role: 'itemlink',
  Presenter: {
    card: (item, ctx) => <ItemLinkCard item={item} ctx={ctx} />,
    full: (item, ctx) => <ItemLinkFull item={item} ctx={ctx} />,
  },
  Block: (item, ctx) => <ItemLinkBlock item={item} ctx={ctx} />,
}
