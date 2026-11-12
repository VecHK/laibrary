import { useEffect, useMemo, useState } from 'react'
import type { ItemID } from '@laibrary/types'
import { parseItemTokens } from '@laibrary/types'
import { openItemById } from '../lib/open-item'
import type { ViewerCtx } from './types'

function InlineItemLink({
  target_id, label, ctx,
}: {
  target_id: ItemID
  label: string | null
  ctx: ViewerCtx
}) {
  const [title, setTitle] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ctx.api.rpc.getItem({ id: target_id })
      .then(item => { if (alive) { setTitle(item.title) } })
      .catch(() => { if (alive) { setTitle(null) } })
    return () => { alive = false }
  }, [target_id, ctx.api.rpc])

  return (
    <button
      className="inline-item-link"
      title={title ?? `#${target_id}`}
      onClick={ev => {
        ev.stopPropagation()
        openItemById(target_id, ctx)
      }}
    >
      {label ?? title ?? `#${target_id}`}
    </button>
  )
}

export function InlineText({ text, ctx }: { text: string; ctx: ViewerCtx }) {
  const tokens = useMemo(() => parseItemTokens(text), [text])
  return (
    <>
      {tokens.map((token, index) => {
        if (token.type === 'text') {
          return <span key={index}>{token.text}</span>
        } else {
          return (
            <InlineItemLink
              key={index}
              target_id={token.target_id}
              label={token.label}
              ctx={ctx}
            />
          )
        }
      })}
    </>
  )
}
