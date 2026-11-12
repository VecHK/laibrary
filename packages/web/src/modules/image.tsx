import { useEffect, useRef, useState } from 'react'
import type {
  ImageAlignment, ImageAttributes, Item, ThumbSize,
} from '@laibrary/types'
import { zImageAttributes } from '@laibrary/types'
import type { ItemModule, ViewerCtx } from './types'
import { blobUrl, thumbUrl } from '../lib/blob'
import { clampImageWidth, pickThumbSize } from '../lib/image-thumb'
import { ImageLightbox } from './image-lightbox'

function imageAttrsOf(item: Item): ImageAttributes {
  const parsed = zImageAttributes.safeParse(item.attributes)
  return parsed.success
    ? parsed.data
    : { filename: item.title || 'image' }
}

function AlignIcon({ align }: { align: ImageAlignment }) {
  const bar_x = align === 'left' ? 5 : align === 'center' ? 8 : 11
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <rect x="2" y="3.5" width="12" height="9" rx="1" />
      <path d={`M${bar_x} 5.2v5.6`} strokeWidth="1.6" />
    </svg>
  )
}

function CaptionIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 3.5h12M2 6.5h12M2 9.5h8M2 12.5h10" />
    </svg>
  )
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M6 3H3v3M10 3h3v3M6 13H3v-3M10 13h3v-3" />
    </svg>
  )
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true">
      <path d="M8 2.5v8M5 7.5 8 10.5l3-3M3 13.5h10" />
    </svg>
  )
}

function ImageCard({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  return (
    <div className="card image-card">
      {item.blob !== null ? (
        <img
          className="image-card-img"
          src={thumbUrl(ctx.api.base_url, item.id, 384)}
          alt={item.title}
          loading="lazy"
        />
      ) : (
        <div className="card-icon">🖼️</div>
      )}
      <div className="card-title">{item.title || '(图片)'}</div>
    </div>
  )
}

type ThumbState = {
  size: ThumbSize
  src: string
}

function ImageBlock({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  const [attrs, setAttrs] = useState<ImageAttributes>(() => imageAttrsOf(item))
  const [width, setWidth] = useState<number | null>(() => imageAttrsOf(item).display_width ?? null)
  const [align, setAlign] = useState<ImageAlignment>(() => imageAttrsOf(item).align ?? 'left')
  const [caption, setCaption] = useState(() => imageAttrsOf(item).caption ?? '')
  const [editing_caption, setEditingCaption] = useState(false)
  const [available_width, setAvailableWidth] = useState(0)
  const [thumb, setThumb] = useState<ThumbState | null>(() => (
    item.blob === null
      ? null
      : { size: 384, src: thumbUrl(ctx.api.base_url, item.id, 384) }
  ))
  const [thumb_failed, setThumbFailed] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [lightbox_open, setLightboxOpen] = useState(false)
  const root_ref = useRef<HTMLDivElement>(null)
  const resize_ref = useRef<{
    side: 'left' | 'right'
    start_x: number
    start_width: number
  } | null>(null)
  const thumb_request_ref = useRef(0)

  useEffect(() => {
    const next = imageAttrsOf(item)
    setAttrs(next)
    setWidth(next.display_width ?? null)
    setAlign(next.align ?? 'left')
    setCaption(next.caption ?? '')
  }, [item.id, item.update_date])

  useEffect(() => {
    const node = root_ref.current
    if (node === null) {
      return undefined
    } else {
      const observer = new ResizeObserver(entries => {
        const first = entries[0]
        setAvailableWidth(first === undefined ? 0 : first.contentRect.width)
      })
      observer.observe(node)
      return () => observer.disconnect()
    }
  }, [])

  useEffect(() => {
    thumb_request_ref.current += 1
    setThumbFailed(false)
    setThumb(item.blob === null ? null : {
      size: 384,
      src: thumbUrl(ctx.api.base_url, item.id, 384),
    })
  }, [item.id, item.blob?.id])

  const natural_width = item.blob?.width ?? 0
  const max_width = Math.min(available_width > 0 ? available_width : 1440, 1440)
  const default_width = natural_width > 0 ? natural_width : max_width
  const shown_width = clampImageWidth(width ?? default_width, max_width)
  const desired_thumb = pickThumbSize(shown_width, window.devicePixelRatio)

  useEffect(() => {
    if (thumb === null || item.blob === null || desired_thumb <= thumb.size) {
      return undefined
    } else {
      const request_id = ++thumb_request_ref.current
      const next_src = thumbUrl(ctx.api.base_url, item.id, desired_thumb)
      const image = new Image()
      image.decoding = 'async'
      image.onload = () => {
        if (request_id === thumb_request_ref.current) {
          setThumb({ size: desired_thumb, src: next_src })
          setThumbFailed(false)
        }
      }
      image.onerror = () => {
        if (request_id === thumb_request_ref.current) {
          setThumbFailed(true)
        }
      }
      image.src = next_src
      return () => {
        image.onload = null
        image.onerror = null
      }
    }
  }, [desired_thumb, thumb, item.id, ctx.api.base_url])

  const saveAttributes = (patch: Partial<ImageAttributes>) => {
    const next = zImageAttributes.parse({ ...attrs, ...patch })
    setAttrs(next)
    if (next.display_width !== undefined) {
      setWidth(next.display_width)
    }
    if (next.align !== undefined) {
      setAlign(next.align)
    }
    if (next.caption !== undefined) {
      setCaption(next.caption)
    }
    ctx.api.rpc.updateItem({ id: item.id, data: { attributes: next } })
      .catch(error => ctx.showError(error instanceof Error ? error.message : String(error)))
  }

  const cycleAlign = () => {
    const next_align = align === 'left' ? 'center' : align === 'center' ? 'right' : 'left'
    setAlign(next_align)
    saveAttributes({ align: next_align })
  }

  const saveCaption = () => {
    const next_caption = caption.trim()
    setCaption(next_caption)
    setEditingCaption(false)
    if (next_caption.length === 0) {
      const rest = Object.fromEntries(
        Object.entries(attrs).filter(([key]) => key !== 'caption'),
      )
      const next = zImageAttributes.parse(rest)
      setAttrs(next)
      ctx.api.rpc.updateItem({ id: item.id, data: { attributes: next } })
        .catch(error => ctx.showError(error instanceof Error ? error.message : String(error)))
    } else {
      saveAttributes({ caption: next_caption })
    }
  }

  const handleResizeStart = (
    side: 'left' | 'right',
    event: React.PointerEvent<HTMLDivElement>,
  ) => {
    event.preventDefault()
    event.stopPropagation()
    resize_ref.current = {
      side,
      start_x: event.clientX,
      start_width: shown_width,
    }
    setResizing(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleResizeMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = resize_ref.current
    if (state !== null) {
      const delta = event.clientX - state.start_x
      const delta_width = state.side === 'right' ? delta : -delta
      setWidth(clampImageWidth(state.start_width + delta_width, max_width))
    }
  }

  const handleResizeEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = resize_ref.current
    if (state !== null) {
      const delta = event.clientX - state.start_x
      const delta_width = state.side === 'right' ? delta : -delta
      const next_width = Math.round(clampImageWidth(state.start_width + delta_width, max_width))
      resize_ref.current = null
      setResizing(false)
      setWidth(next_width)
      event.currentTarget.releasePointerCapture(event.pointerId)
      saveAttributes({ display_width: next_width })
    }
  }

  const filename = attrs.filename || item.title || 'image'
  const original_src = item.blob === null ? null : blobUrl(ctx.api.base_url, item.blob.id)
  const blob_width = item.blob?.width ?? null
  const blob_height = item.blob?.height ?? null
  const aspect_ratio = blob_width !== null && blob_height !== null
    ? `${blob_width} / ${blob_height}`
    : undefined

  return (
    <div
      className={`block-image image-align-${align}${resizing ? ' is-resizing' : ''}`}
      ref={root_ref}
    >
      <div
        className="image-frame"
        style={{ width: `${shown_width}px`, maxWidth: '100%', aspectRatio: aspect_ratio }}
        onDoubleClick={event => {
          event.stopPropagation()
          if (item.blob !== null) {
            setLightboxOpen(true)
          }
        }}
      >
        {thumb === null ? (
          <div className="image-missing">图片缺失</div>
        ) : (
          <img
            className="image-content"
            src={thumb.src}
            alt={item.title}
            draggable={false}
            onError={() => setThumbFailed(true)}
          />
        )}
        {thumb_failed && <div className="image-load-error">缩略图加载失败</div>}
        {item.blob !== null && (
          <>
            <div
              className="image-resizer left"
              role="separator"
              aria-label="调整图片宽度"
              onPointerDown={event => handleResizeStart('left', event)}
              onPointerMove={handleResizeMove}
              onPointerUp={handleResizeEnd}
              onPointerCancel={() => { resize_ref.current = null; setResizing(false) }}
            />
            <div
              className="image-resizer right"
              role="separator"
              aria-label="调整图片宽度"
              onPointerDown={event => handleResizeStart('right', event)}
              onPointerMove={handleResizeMove}
              onPointerUp={handleResizeEnd}
              onPointerCancel={() => { resize_ref.current = null; setResizing(false) }}
            />
            <div className="image-toolbar" onPointerDown={event => event.stopPropagation()}>
              <button
                type="button"
                className="image-tool-button"
                title={`对齐：${align}`}
                aria-label="切换图片对齐"
                onClick={cycleAlign}
              ><AlignIcon align={align} /></button>
              <button
                type="button"
                className="image-tool-button"
                title={editing_caption ? '关闭 caption 编辑' : '编辑 caption'}
                aria-label="编辑 caption"
                onClick={() => setEditingCaption(value => !value)}
              ><CaptionIcon /></button>
              <button
                type="button"
                className="image-tool-button"
                title="查看大图"
                aria-label="查看大图"
                onClick={() => setLightboxOpen(true)}
              ><ExpandIcon /></button>
              <a
                className="image-tool-button"
                href={original_src ?? '#'}
                download={filename}
                title="下载原图"
                aria-label="下载原图"
                onClick={event => event.stopPropagation()}
              ><DownloadIcon /></a>
            </div>
          </>
        )}
      </div>
      {(caption.length !== 0 || editing_caption) && (
        <div className="image-caption-wrap" style={{ width: `${shown_width}px`, maxWidth: '100%' }}>
          {editing_caption ? (
            <input
              className="image-caption-input"
              autoFocus
              value={caption}
              placeholder="添加 caption"
              onChange={event => setCaption(event.target.value)}
              onBlur={saveCaption}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  event.currentTarget.blur()
                } else if (event.key === 'Escape') {
                  event.preventDefault()
                  setCaption(attrs.caption ?? '')
                  setEditingCaption(false)
                }
              }}
            />
          ) : (
            <div
              className="block-caption"
              title="点击编辑 caption"
              onClick={event => {
                event.stopPropagation()
                setEditingCaption(true)
              }}
            >{caption}</div>
          )}
        </div>
      )}
      {lightbox_open && (
        <ImageLightbox item={item} ctx={ctx} on_close={() => setLightboxOpen(false)} />
      )}
    </div>
  )
}

function ImageFull({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  const src = item.blob === null ? null : blobUrl(ctx.api.base_url, item.blob.id)
  return (
    <div className="image-full" onClick={() => ctx.navigate(item.parent_id ?? item.id)}>
      <div className="image-full-bar">
        <span className="image-full-title">{item.title}</span>
      </div>
      {src !== null ? (
        <img className="image-full-img" src={src} alt={item.title} />
      ) : (
        <div className="empty-hint">图片文件缺失</div>
      )}
    </div>
  )
}

export const __IMAGE_MODULE__: ItemModule = {
  role: 'image',
  Presenter: {
    card: (item, ctx) => <ImageCard item={item} ctx={ctx} />,
    full: (item, ctx) => <ImageFull item={item} ctx={ctx} />,
  },
  Block: (item, ctx) => <ImageBlock item={item} ctx={ctx} />,
}
