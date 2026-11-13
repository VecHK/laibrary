import { useState } from 'react'
import type { Item } from '@laibrary/types'
import type { ItemModule, ViewerCtx } from './types'

function TagCard({ item }: { item: Item }) {
  return <span className="tag-chip">#{item.title}</span>
}

function TagFull({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  const [value, setValue] = useState(item.title)
  const [saving, setSaving] = useState(false)

  const save = () => {
    if (value.length === 0) {
      ctx.showError('tag 名不能为空')
    } else {
      setSaving(true)
      ctx.api.rpc.updateTag({ id: item.id, data: { title: value } })
        .then(async () => {
          await ctx.tags.load()
          ctx.refresh()
          setSaving(false)
        })
        .catch(err => {
          ctx.showError(err instanceof Error ? err.message : String(err))
          setSaving(false)
        })
    }
  }

  return (
    <div className="panel">
      <div className="panel-title">Tag</div>
      <input
        className="big-input"
        value={value}
        onChange={ev => setValue(ev.target.value)}
        onKeyDown={ev => {
          if (ev.key === 'Enter') {
            save()
          }
        }}
      />
      <button className="button" disabled={saving} onClick={save}>保存</button>
    </div>
  )
}

export const __TAG_MODULE__: ItemModule = {
  role: 'tag',
  Presenter: {
    card: (item) => <TagCard item={item} />,
    full: (item, ctx) => <TagFull item={item} ctx={ctx} />,
  },
}
