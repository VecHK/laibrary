import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Item } from '@laibrary/types'
import type { ViewerCtx } from '../modules/types'
import { formatItemDate } from '../lib/date-format'
import { itemUrl } from '../lib/item-url'

type MenuAction = 'copy' | 'rename' | 'move' | 'tab' | 'peek' | 'remove'

function MenuIcon({ name }: { name: MenuAction }) {
  if (name === 'copy') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6.5 9.5 9.5 6.5" />
        <path d="M5.5 11.5 4 13a2.5 2.5 0 0 1-3.5-3.5l2-2A2.5 2.5 0 0 1 6 7.5" />
        <path d="M10.5 4.5 12 3a2.5 2.5 0 0 1 3.5 3.5l-2 2A2.5 2.5 0 0 1 10 8.5" />
      </svg>
    )
  } else if (name === 'rename') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 12.5 3.5 9 10.5 2l3.5 3.5L7 12.5z" />
        <path d="m9.5 3 3.5 3.5" />
      </svg>
    )
  } else if (name === 'move') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M2.5 3.5h5l1.5 2h4.5v7.5h-11z" />
        <path d="M8 11V7.5M6 9l2-2 2 2" />
      </svg>
    )
  } else if (name === 'tab') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M6 3H3v10h10v-3" />
        <path d="M9 3h4v4M8 8l5-5" />
      </svg>
    )
  } else if (name === 'peek') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="2" y="3" width="12" height="10" rx="1.5" />
        <path d="M10 3v10" />
      </svg>
    )
  } else {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M3 4.5h10M6 4.5V3h4v1.5M4.5 4.5l.5 9h6l.5-9" />
      </svg>
    )
  }
}

export function SidebarItemMenu({
  item,
  ctx,
  anchor,
  on_close,
  on_rename,
  on_move,
  on_peek,
  on_remove,
}: {
  item: Item
  ctx: ViewerCtx
  anchor: { left: number; right: number; bottom: number }
  on_close: () => void
  on_rename: () => void
  on_move: () => void
  on_peek: () => void
  on_remove: () => void
}) {
  const $root_ref = useRef<HTMLDivElement>(null)
  const left = Math.max(8, Math.min(anchor.right + 6, window.innerWidth - 268))
  const top = Math.max(8, Math.min(anchor.bottom + 4, window.innerHeight - 390))

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.tree-more') !== null) {
        // “···”按钮自己负责切换，避免 pointerdown 先关再开。
      } else if (event.target instanceof Node && $root_ref.current !== null && !$root_ref.current.contains(event.target)) {
        on_close()
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        on_close()
      }
    }
    const onScroll = () => on_close()
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [on_close])

  const copyLink = () => {
    const url = itemUrl(item.id)
    if (navigator.clipboard === undefined) {
      window.prompt('复制链接', url)
    } else {
      void navigator.clipboard.writeText(url)
        .then(() => ctx.showNotice('链接已复制'))
        .catch(() => window.prompt('复制链接', url))
    }
    on_close()
  }

  const openInNewTab = () => {
    window.open(itemUrl(item.id), '_blank', 'noopener,noreferrer')
    on_close()
  }

  const menu = (
    <div
      ref={$root_ref}
      className="sidebar-item-menu"
      style={{ left: `${left}px`, top: `${top}px` }}
      role="menu"
    >
      <div className="sidebar-menu-kind">{item.role}</div>
      <button type="button" className="sidebar-menu-item" role="menuitem" onClick={copyLink}>
        <span className="sidebar-menu-icon"><MenuIcon name="copy" /></span>
        <span>Copy link</span>
      </button>
      <button
        type="button"
        className="sidebar-menu-item"
        role="menuitem"
        onClick={() => {
          on_rename()
          on_close()
        }}
      >
        <span className="sidebar-menu-icon"><MenuIcon name="rename" /></span>
        <span>Rename</span>
      </button>
      <button
        type="button"
        className="sidebar-menu-item"
        role="menuitem"
        onClick={() => {
          on_move()
          on_close()
        }}
      >
        <span className="sidebar-menu-icon"><MenuIcon name="move" /></span>
        <span>Move to</span>
      </button>
      <div className="sidebar-menu-separator" />
      <button type="button" className="sidebar-menu-item" role="menuitem" onClick={openInNewTab}>
        <span className="sidebar-menu-icon"><MenuIcon name="tab" /></span>
        <span>Open in new tab</span>
      </button>
      <button
        type="button"
        className="sidebar-menu-item"
        role="menuitem"
        onClick={() => {
          on_peek()
          on_close()
        }}
      >
        <span className="sidebar-menu-icon"><MenuIcon name="peek" /></span>
        <span>Open in side peek</span>
      </button>
      <div className="sidebar-menu-separator" />
      <button
        type="button"
        className="sidebar-menu-item is-danger"
        role="menuitem"
        onClick={() => {
          on_remove()
          on_close()
        }}
      >
        <span className="sidebar-menu-icon"><MenuIcon name="remove" /></span>
        <span>Remove</span>
      </button>
      <div className="sidebar-menu-meta">
        <div>
          <span>Last edited</span>
          <time dateTime={item.update_date}>{formatItemDate(item.update_date)}</time>
        </div>
        <div>
          <span>Created Date</span>
          <time dateTime={item.create_date}>{formatItemDate(item.create_date)}</time>
        </div>
      </div>
    </div>
  )

  return createPortal(menu, document.body)
}
