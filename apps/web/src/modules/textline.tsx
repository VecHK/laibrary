import { useEffect, useMemo, useRef, useState } from 'react'
import type { Item } from '@laibrary/types'
import { formatItemToken, parseItemTokens } from '@laibrary/types'
import { getRpc } from '../lib/rpc'
import { openItemById } from '../lib/open-item'
import type { ItemModule, ViewerCtx } from './types'
import { ItemPicker } from './item-picker'

function InlineItemLink({
  target_id, label, ctx,
}: {
  target_id: number
  label: string | null
  ctx: ViewerCtx
}) {
  const [title, setTitle] = useState<string | null>(null)
  useEffect(() => {
    let alive = true
    getRpc().getItem({ id: target_id })
      .then(item => { if (alive) setTitle(item.title) })
      .catch(() => { if (alive) setTitle(null) })
    return () => { alive = false }
  }, [target_id])

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

function InlineText({ text, ctx }: { text: string; ctx: ViewerCtx }) {
  const tokens = useMemo(() => parseItemTokens(text), [text])
  return (
    <>
      {tokens.map((token, index) => {
        if (token.type === 'text') {
          return <span key={index}>{token.text}</span>
        }
        return (
          <InlineItemLink
            key={index}
            target_id={token.target_id}
            label={token.label}
            ctx={ctx}
          />
        )
      })}
    </>
  )
}

function TextLineEditor({
  item,
  ctx,
  autoFocus = false,
}: {
  item: Item
  ctx: ViewerCtx
  autoFocus?: boolean
}) {
  const [editing, setEditing] = useState(autoFocus)
  const [value, setValue] = useState(item.title)
  const [picker, setPicker] = useState(false)
  const timer_ref = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textarea_ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setValue(item.title)
  }, [item.id, item.title])

  useEffect(() => {
    if (editing && textarea_ref.current !== null) {
      textarea_ref.current.focus()
      const len = textarea_ref.current.value.length
      textarea_ref.current.setSelectionRange(len, len)
    }
  }, [editing])

  const save = (next: string) => {
    setValue(next)
    if (timer_ref.current !== null) clearTimeout(timer_ref.current)
    timer_ref.current = setTimeout(() => {
      getRpc().updateItem({ id: item.id, data: { title: next } })
        .then(() => ctx.refresh())
        .catch(err => ctx.showError(err instanceof Error ? err.message : String(err)))
    }, 400)
  }

  const saveNow = () => {
    if (timer_ref.current !== null) {
      clearTimeout(timer_ref.current)
      timer_ref.current = null
    }
    getRpc().updateItem({ id: item.id, data: { title: value } })
      .then(() => ctx.refresh())
      .catch(err => ctx.showError(err instanceof Error ? err.message : String(err)))
  }

  const insertAfter = () => {
    getRpc().addItem({
      role: 'textline',
      title: '',
      parent_id: item.parent_id,
      order_index: item.order_index + 0.5,
    }).then(() => {
      ctx.refresh()
    }).catch(err => ctx.showError(err instanceof Error ? err.message : String(err)))
  }

  const removeSelf = () => {
    getRpc().deleteItem({ id: item.id })
      .then(() => ctx.refresh())
      .catch(err => ctx.showError(err instanceof Error ? err.message : String(err)))
  }

  if (!editing) {
    return (
      <div className="textline-block">
        <div
          className="textline-view"
          onClick={() => setEditing(true)}
        >
          {value.length === 0
            ? <span className="empty-hint-inline">空行</span>
            : <InlineText text={value} ctx={ctx} />}
        </div>
      </div>
    )
  }

  return (
    <div className="textline-block">
      <div className="textline-edit-row">
        <textarea
          ref={textarea_ref}
          className="textline-textarea"
          value={value}
          placeholder="输入文本，Enter 换行，空行 Backspace 删除"
          rows={1}
          onChange={ev => save(ev.target.value)}
          onBlur={() => {
            saveNow()
            setEditing(false)
          }}
          onKeyDown={ev => {
            if (ev.key === 'Enter' && !ev.shiftKey) {
              ev.preventDefault()
              saveNow()
              insertAfter()
            } else if (ev.key === 'Backspace' && value.length === 0) {
              ev.preventDefault()
              removeSelf()
            }
          }}
        />
        <button
          className="tool-button"
          title="插入 item 链接"
          onMouseDown={ev => ev.preventDefault()}
          onClick={() => setPicker(true)}
        >
          🔗
        </button>
      </div>
      {picker && (
        <ItemPicker
          onClose={() => setPicker(false)}
          onSelect={target => {
            const token = formatItemToken(target.id)
            save(`${value}${value.length > 0 ? ' ' : ''}${token}`)
          }}
        />
      )}
    </div>
  )
}

function TextLineCard({ item }: { item: Item }) {
  const tokens = parseItemTokens(item.title)
  return (
    <div className="card textline-card">
      <div className="card-title">
        {tokens.length === 0
          ? '(空行)'
          : tokens.map((token, index) => token.type === 'text'
            ? <span key={index}>{token.text}</span>
            : <span key={index} className="inline-link-text">@{token.label ?? token.target_id}</span>)}
      </div>
      <div className="card-sub">文本</div>
    </div>
  )
}

function TextLineFull({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  return (
    <div className="panel">
      <TextLineEditor item={item} ctx={ctx} autoFocus />
    </div>
  )
}

export function TextLineBlock({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  return <TextLineEditor item={item} ctx={ctx} />
}

export const textlineModule: ItemModule = {
  role: 'textline',
  Presenter: {
    card: item => <TextLineCard item={item} />,
    full: (item, ctx) => <TextLineFull item={item} ctx={ctx} />,
  },
  Block: (item, ctx) => <TextLineBlock item={item} ctx={ctx} />,
}
