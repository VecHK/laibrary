import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Item } from '@laibrary/types'
import type { ViewerCtx } from './types'
import { blobUrl, thumbUrl } from '../lib/blob'

const MAX_SCALE = 5

function clampScale(value: number): number {
  return Math.min(MAX_SCALE, Math.max(1, value))
}

export function ImageLightbox({
  item,
  ctx,
  on_close,
}: {
  item: Item
  ctx: ViewerCtx
  on_close: () => void
}) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [loaded, setLoaded] = useState(false)
  const [failed, setFailed] = useState(false)
  const $drag_ref = useRef<{ x: number, y: number, ox: number, oy: number } | null>(null)
  const original = item.blob === null ? null : blobUrl(ctx.api.base_url, item.blob.id)
  const thumb = item.blob === null ? null : thumbUrl(ctx.api.base_url, item.id, 384)

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        on_close()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [on_close])

  const resetZoom = () => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }

  const onWheel = (event: React.WheelEvent) => {
    event.preventDefault()
    const next = clampScale(scale * (event.deltaY < 0 ? 1.12 : 0.89))
    setScale(next)
    if (next === 1) {
      setPosition({ x: 0, y: 0 })
    }
  }

  return createPortal(
    <div
      className="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={item.title || '查看大图'}
      onClick={event => {
        if (event.target === event.currentTarget) {
          on_close()
        }
      }}
    >
      <button type="button" className="image-lightbox-close" onClick={on_close}>×</button>
      <div
        className={scale > 1 ? 'image-lightbox-frame is-zoomed' : 'image-lightbox-frame'}
        style={{ transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})` }}
        onWheel={onWheel}
        onDoubleClick={event => {
          event.stopPropagation()
          if (scale > 1) {
            resetZoom()
          } else {
            setScale(1.5)
          }
        }}
        onPointerDown={event => {
          if (scale > 1 && event.button === 0 && !(event.target instanceof Element && event.target.closest('button'))) {
            event.currentTarget.setPointerCapture(event.pointerId)
            $drag_ref.current = {
              x: event.clientX,
              y: event.clientY,
              ox: position.x,
              oy: position.y,
            }
          }
        }}
        onPointerMove={event => {
          const drag = $drag_ref.current
          if (drag !== null) {
            setPosition({
              x: drag.ox + event.clientX - drag.x,
              y: drag.oy + event.clientY - drag.y,
            })
          }
        }}
        onPointerUp={event => {
          if ($drag_ref.current !== null) {
            event.currentTarget.releasePointerCapture(event.pointerId)
            $drag_ref.current = null
          }
        }}
        onPointerCancel={() => { $drag_ref.current = null }}
        onClick={event => event.stopPropagation()}
      >
        {thumb !== null && !loaded && (
          <img className="image-lightbox-thumb" src={thumb} alt="" draggable={false} />
        )}
        {original !== null && !failed ? (
          <img
            className={loaded ? 'image-lightbox-img is-loaded' : 'image-lightbox-img'}
            src={original}
            alt={item.title}
            width={item.blob?.width ?? undefined}
            height={item.blob?.height ?? undefined}
            draggable={false}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="image-lightbox-error">图片加载失败</div>
        )}
      </div>
    </div>,
    document.body,
  )
}
