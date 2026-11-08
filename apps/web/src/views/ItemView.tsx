import { useEffect, useState } from 'react'
import { Item } from '@laibrary/types'
import { getRpc } from '../lib/rpc'
import { getTagTitle, loadTags } from '../lib/tags'
import { resolveModule } from '../modules/registry'
import type { ViewerCtx } from '../modules/types'

function TagBar({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  const [input_value, setInputValue] = useState('')

  const addTag = (title: string) => {
    const trimmed = title.trim()
    if (trimmed.length === 0) {
      return
    }
    (async () => {
      try {
        let tag = await getRpc().getTagByTitle({ title: trimmed })
        if (tag === null) {
          tag = await getRpc().newTag({ title: trimmed })
          await loadTags()
        }
        await getRpc().updateItem({
          id: item.id,
          data: { tags: [...new Set([...item.tags, tag.id])] },
        })
        setInputValue('')
        ctx.refresh()
      } catch (err) {
        ctx.showError(err instanceof Error ? err.message : String(err))
      }
    })()
  }

  const removeTag = (tag_id: number) => {
    getRpc().updateItem({
      id: item.id,
      data: { tags: item.tags.filter(id => id !== tag_id) },
    }).then(() => ctx.refresh()).catch(err => {
      ctx.showError(err instanceof Error ? err.message : String(err))
    })
  }

  return (
    <div className="tag-bar">
      <span className="tag-bar-label">标签:</span>
      {item.tags.map(tag_id => (
        <span key={tag_id} className="tag-chip removable">
          <span className="tag-chip-name" onClick={() => ctx.navigate(tag_id)}>
            #{getTagTitle(tag_id) ?? tag_id}
          </span>
          <button className="tool-button" onClick={() => removeTag(tag_id)}>✕</button>
        </span>
      ))}
      <input
        className="tag-input"
        value={input_value}
        placeholder="+ 标签"
        onChange={ev => setInputValue(ev.target.value)}
        onKeyDown={ev => {
          if (ev.key === 'Enter') {
            addTag(input_value)
          }
        }}
        onBlur={() => {
          if (input_value.trim().length !== 0) {
            addTag(input_value)
          }
        }}
      />
    </div>
  )
}

export function ItemView({
  item_id,
  ctx,
  refresh_key,
}: {
  item_id: number
  ctx: ViewerCtx
  refresh_key: number
}) {
  const [item, setItem] = useState<Item | null>(null)
  const [not_found, setNotFound] = useState(false)

  useEffect(() => {
    setNotFound(false)
    setItem(null)
    getRpc().getItem({ id: item_id }).then(setItem).catch(err => {
      setNotFound(true)
      ctx.showError(err instanceof Error ? err.message : String(err))
    })
  }, [item_id, refresh_key])

  if (not_found) {
    return (
      <div className="panel">
        <div className="empty-hint">item 不存在</div>
        <button className="button" onClick={() => ctx.navigate({ name: 'plaza' })}>返回广场</button>
      </div>
    )
  }

  if (item === null) {
    return <div className="loading">加载中…</div>
  }

  const module = resolveModule(item)
  const back = () => {
    if (item.parent_id !== null) {
      ctx.navigate(item.parent_id)
    } else {
      ctx.navigate({ name: 'plaza' })
    }
  }

  return (
    <div className="item-view">
      <div className="breadcrumb">
        <button className="link-button" onClick={back}>⬅ 返回</button>
        <span className="breadcrumb-role">{item.role}{item.kind ? ` · ${item.kind}` : ''}</span>
      </div>
      <div className="item-content">
        {module.Presenter.full(item, ctx)}
      </div>
      <TagBar item={item} ctx={ctx} />
    </div>
  )
}
