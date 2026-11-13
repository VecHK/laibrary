import { useEffect, useRef, useState } from 'react'
import type { Item, Role, RoleAttributes } from '@laibrary/types'
import { zAnyAttributes, zDatabaseAttributes, zIcon } from '@laibrary/types'
import type { ViewerCtx } from './types'

export const ICON_PALETTE = [
  '📄', '📝', '📚', '📖', '🗂️', '🗃️',
  '📊', '📈', '🗄️', '💡', '🎯', '✅',
  '⭐', '🔥', '🧠', '🧪', '🛠️', '🌱',
  '🎨', '🎵', '🏠', '💼', '🧭', '✨',
] as const

function fallbackIcon(item: Item): string {
  if (item.role === 'database') {
    return '🗄️'
  } else if (item.role === 'itemlink') {
    return '🔗'
  } else {
    return '📄'
  }
}

export function itemIconOf(item: Item): string {
  if (item.role === 'database') {
    const parsed = zDatabaseAttributes.safeParse(item.attributes)
    if (parsed.success) {
      return parsed.data.icon ?? fallbackIcon(item)
    } else {
      return fallbackIcon(item)
    }
  } else if (item.role === 'page' || item.role === 'itemlink') {
    const parsed = zAnyAttributes.safeParse(item.attributes)
    if (parsed.success) {
      const icon = zIcon.safeParse(parsed.data['icon'])
      return icon.success ? icon.data : fallbackIcon(item)
    } else {
      return fallbackIcon(item)
    }
  } else {
    return fallbackIcon(item)
  }
}

export function itemIconAttributes(item: Item, icon: string | null): RoleAttributes[Role] {
  if (item.role === 'database') {
    const attributes = zDatabaseAttributes.parse(item.attributes)
    if (icon === null) {
      return { schema: attributes.schema }
    } else {
      return { schema: attributes.schema, icon }
    }
  } else {
    const attributes = zAnyAttributes.parse(item.attributes)
    const rest = Object.fromEntries(
      Object.entries(attributes).filter(([key]) => key !== 'icon'),
    )
    if (icon === null) {
      return rest
    } else {
      return { ...rest, icon }
    }
  }
}

export function ItemIcon({ item, size = 'small' }: { item: Item; size?: 'small' | 'large' }) {
  return (
    <span className={`item-icon item-icon-${size}`} aria-hidden="true">
      {itemIconOf(item)}
    </span>
  )
}

export function ItemIconButton({
  item,
  ctx,
}: {
  item: Item
  ctx: ViewerCtx
}) {
  const [open, setOpen] = useState(false)
  const [custom, setCustom] = useState('')
  const [icon, setIcon] = useState(() => itemIconOf(item))
  const $root_ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setIcon(itemIconOf(item))
  }, [item.id, item.update_date])

  useEffect(() => {
    if (!open) {
      return undefined
    } else {
      const onPointerDown = (event: PointerEvent) => {
        if (event.target instanceof Node && $root_ref.current !== null && !$root_ref.current.contains(event.target)) {
          setOpen(false)
        }
      }
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          setOpen(false)
        }
      }
      document.addEventListener('pointerdown', onPointerDown)
      document.addEventListener('keydown', onKeyDown)
      return () => {
        document.removeEventListener('pointerdown', onPointerDown)
        document.removeEventListener('keydown', onKeyDown)
      }
    }
  }, [open])

  const saveIcon = (next_icon: string | null) => {
    const attributes = itemIconAttributes(item, next_icon)
    ctx.api.rpc.updateItem({ id: item.id, data: { attributes } })
      .then(() => {
        setIcon(next_icon ?? itemIconOf({ ...item, attributes }))
        setCustom('')
        setOpen(false)
        ctx.refresh()
      })
      .catch(error => {
        ctx.showError(error instanceof Error ? error.message : String(error))
      })
  }

  const applyIcon = (next_icon: string | null) => {
    if (next_icon === null) {
      saveIcon(null)
    } else {
      const parsed = zIcon.safeParse(next_icon)
      if (!parsed.success) {
        ctx.showError('图标必须是 1-16 字符的 emoji 文本')
      } else {
        saveIcon(parsed.data)
      }
    }
  }

  return (
    <div className="item-icon-control" ref={$root_ref}>
      <button
        type="button"
        className="item-icon-button"
        aria-label="修改图标"
        title="修改图标"
        onClick={() => setOpen(value => !value)}
      >
        {icon}
      </button>
      {open && (
        <div className="icon-picker" role="dialog" aria-label="选择图标">
          <div className="icon-picker-title">选择图标</div>
          <div className="icon-picker-grid">
            {ICON_PALETTE.map(emoji => (
              <button
                key={emoji}
                type="button"
                className="icon-picker-item"
                onClick={() => applyIcon(emoji)}
              >{emoji}</button>
            ))}
          </div>
          <div className="icon-picker-custom">
            <input
              className="icon-picker-input"
              value={custom}
              maxLength={16}
              placeholder="粘贴 emoji"
              onChange={ev => setCustom(ev.target.value)}
              onKeyDown={ev => {
                if (ev.key === 'Enter') {
                  applyIcon(custom)
                }
              }}
            />
            <button type="button" className="button" onClick={() => applyIcon(custom)}>使用</button>
          </div>
          <button
            type="button"
            className="icon-picker-clear"
            onClick={() => applyIcon(null)}
          >清除图标</button>
        </div>
      )}
    </div>
  )
}
