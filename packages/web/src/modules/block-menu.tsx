import { useEffect, useRef } from 'react'

export type BlockMenuProps = {
  readonly can_duplicate: boolean
  readonly can_delete: boolean
  readonly can_move_up: boolean
  readonly can_move_down: boolean
  readonly on_duplicate: () => void
  readonly on_move_up: () => void
  readonly on_move_down: () => void
  readonly on_delete: () => void
  readonly on_close: () => void
}

function MenuIcon({ name }: { name: 'duplicate' | 'up' | 'down' | 'trash' }) {
  if (name === 'duplicate') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <rect x="5" y="5" width="8" height="8" rx="1.5" />
        <path d="M3 10V3.5A1.5 1.5 0 0 1 4.5 2H11" />
      </svg>
    )
  } else if (name === 'up') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 12V4M4.5 7.5 8 4l3.5 3.5" />
      </svg>
    )
  } else if (name === 'down') {
    return (
      <svg viewBox="0 0 16 16" aria-hidden="true">
        <path d="M8 4v8M4.5 8.5 8 12l3.5-3.5" />
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

export function BlockMenu({
  can_duplicate,
  can_delete,
  can_move_up,
  can_move_down,
  on_duplicate,
  on_move_up,
  on_move_down,
  on_delete,
  on_close,
}: BlockMenuProps) {
  const root_ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('.block-drag-handle') !== null) {
        // 点击把手由 PageBlock 自己处理开关，避免 pointerdown 先关再开。
      } else if (event.target instanceof Node && root_ref.current !== null && !root_ref.current.contains(event.target)) {
        on_close()
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        on_close()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [on_close])

  return (
    <div className="block-menu" role="menu" ref={root_ref}>
      <button
        type="button"
        className="block-menu-item"
        role="menuitem"
        disabled={!can_duplicate}
        onClick={on_duplicate}
      >
        <span className="block-menu-icon"><MenuIcon name="duplicate" /></span>
        <span>创建副本</span>
      </button>
      <div className="block-menu-separator" />
      <button
        type="button"
        className="block-menu-item"
        role="menuitem"
        disabled={!can_move_up}
        onClick={on_move_up}
      >
        <span className="block-menu-icon"><MenuIcon name="up" /></span>
        <span>上移</span>
      </button>
      <button
        type="button"
        className="block-menu-item"
        role="menuitem"
        disabled={!can_move_down}
        onClick={on_move_down}
      >
        <span className="block-menu-icon"><MenuIcon name="down" /></span>
        <span>下移</span>
      </button>
      <div className="block-menu-separator" />
      <button
        type="button"
        className="block-menu-item is-danger"
        role="menuitem"
        disabled={!can_delete}
        onClick={on_delete}
      >
        <span className="block-menu-icon"><MenuIcon name="trash" /></span>
        <span>删除</span>
      </button>
    </div>
  )
}
