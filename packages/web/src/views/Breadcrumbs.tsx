import { useEffect, useState } from 'react'
import type { Item } from '@laibrary/types'
import type { ViewerCtx } from '../modules/types'

function labelOf(item: Item): string {
  return item.title.length === 0 ? '无标题' : item.title
}

export function Breadcrumbs({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  const [ancestors, setAncestors] = useState<readonly Item[]>([])

  useEffect(() => {
    let $_alive = true
    setAncestors([])
    const load = async () => {
      let $chain: Item[] = []
      const $seen = new Set<number>([item.id])
      let $parent_id = item.parent_id
      while ($parent_id !== null && !$seen.has($parent_id) && $chain.length < 100) {
        $seen.add($parent_id)
        const parent = await ctx.api.rpc.getItem({ id: $parent_id })
        $chain = [...$chain, parent]
        $parent_id = parent.parent_id
      }
      if ($_alive) {
        setAncestors($chain.toReversed())
      }
    }
    load().catch(error => {
      console.warn('breadcrumb parent load', error)
    })
    return () => { $_alive = false }
  }, [item.id, item.parent_id, ctx.api.rpc])

  return (
    <nav className="breadcrumbs" aria-label="Breadcrumb">
      <button
        type="button"
        className="breadcrumb-link breadcrumb-home"
        onClick={() => ctx.navigate({ name: 'plaza' })}
      >
        <span className="breadcrumb-home-icon" aria-hidden="true">🏠</span>
        <span>Home Page</span>
      </button>
      {ancestors.map(ancestor => (
        <span className="breadcrumb-segment" key={ancestor.id}>
          <span className="breadcrumb-separator" aria-hidden="true">/</span>
          <button
            type="button"
            className="breadcrumb-link"
            onClick={() => ctx.navigate(ancestor.id)}
          >
            {labelOf(ancestor)}
          </button>
        </span>
      ))}
      <span className="breadcrumb-segment">
        <span className="breadcrumb-separator" aria-hidden="true">/</span>
        <span className="breadcrumb-current" aria-current="page">{labelOf(item)}</span>
      </span>
    </nav>
  )
}
