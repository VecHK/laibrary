import { useEffect, useRef, useState } from 'react'
import type { Item, ItemID } from '@laibrary/types'
import { zAnyAttributes } from '@laibrary/types'
import { blobUrl, thumbUrl, createImageItem } from '../lib/blob'
import type { ItemModule, ViewerCtx } from './types'

const TRANSPARENT_PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=='

type MangaPage = {
  id: ItemID
  src: string
  width: number
  height: number
  order_index: number
}

function explicitDirectionOf(item: Item): 'rtl' | 'ltr' | null {
  const parsed = zAnyAttributes.safeParse(item.attributes)
  if (!parsed.success) {
    return null
  } else if (parsed.data['reading_direction'] === 'ltr') {
    return 'ltr'
  } else if (parsed.data['reading_direction'] === 'rtl') {
    return 'rtl'
  } else {
    return null
  }
}

function directionOf(item: Item): 'rtl' | 'ltr' {
  return explicitDirectionOf(item) ?? 'rtl'
}

function useFirstImage(item: Item, ctx: ViewerCtx): Item | null {
  const [image, setImage] = useState<Item | null>(null)
  useEffect(() => {
    ctx.api.rpc.listing({
      limit: 1,
      sort_by: 'order_index',
      filter_rules: [
        { name: 'parent', input: item.id, logic: 'and' },
        { name: 'role', input: 'image', logic: 'and' },
      ],
    }).then(rows => setImage(rows[0] ?? null)).catch(error => {
      console.warn('manga cover load failed', error)
      setImage(null)
    })
  }, [item.id, ctx.api.rpc])
  return image
}

function MangaInline({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  const first = useFirstImage(item, ctx)
  return first === null
    ? <span className="block-entity-emoji">📖</span>
    : <img className="block-entity-thumb" src={thumbUrl(ctx.api.base_url, first.id, 96)} alt="" />
}

function MangaCard({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  const first = useFirstImage(item, ctx)
  return (
    <div className="card manga-card" onClick={() => ctx.navigate(item.id)}>
      {first === null ? (
        <div className="card-icon">📖</div>
      ) : (
        <img className="manga-card-cover" src={thumbUrl(ctx.api.base_url, first.id, 384)} alt="" loading="lazy" />
      )}
      <div className="card-title">{item.title || '(漫画)'}</div>
      <div className="card-sub">
        漫画 · {directionOf(item) === 'rtl' ? '右开' : '左开'}
      </div>
    </div>
  )
}

function readProgress(item: Item): number {
  const raw = localStorage.getItem(`laibrary.manga.${item.id}`)
  const value = raw === null ? 0 : Number.parseInt(raw, 10)
  return Number.isFinite(value) ? value : 0
}

function writeProgress(item: Item, index: number) {
  localStorage.setItem(`laibrary.manga.${item.id}`, String(index))
}

function MangaReader({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  const [pages, setPages] = useState<MangaPage[] | null>(null)
  const [direction, setDirection] = useState<'rtl' | 'ltr'>(directionOf(item))
  const [loaded_srcs, setLoadedSrcs] = useState<Record<number, string>>({})
  const [current_index, setCurrentIndex] = useState(0)
  const [resize_tick, setResizeTick] = useState(0)
  const container_ref = useRef<HTMLDivElement>(null)
  const loaded_ref = useRef(new Set<number>())
  const file_input_ref = useRef<HTMLInputElement>(null)

  const loadPages = () => {
    ctx.api.rpc.listing({
      limit: 0,
      sort_by: 'order_index',
      filter_rules: [
        { name: 'parent', input: item.id, logic: 'and' },
        { name: 'role', input: 'image', logic: 'and' },
      ],
    }).then(children => {
      setPages(children.map(child => ({
        id: child.id,
        src: child.blob === null ? '' : blobUrl(ctx.api.base_url, child.blob.id),
        width: child.blob?.width ?? 0,
        height: child.blob?.height ?? 0,
        order_index: child.order_index,
      })))
      loaded_ref.current.clear()
      setLoadedSrcs({})
    }).catch(err => ctx.showError(err instanceof Error ? err.message : String(err)))
  }

  useEffect(loadPages, [item.id])

  useEffect(() => {
    const explicit = explicitDirectionOf(item)
    if (explicit !== null) {
      setDirection(explicit)
      return
    }
    setDirection('rtl')
    ctx.api.rpc.getConfig().then(snapshot => {
      const entry = snapshot.entries.find(e => e.key === 'sys.config.manga_default_direction')
      if (entry?.value === 'ltr' || entry?.value === 'rtl') {
        setDirection(entry.value)
      }
    }).catch(error => { console.warn('manga config fallback', error) })
  }, [item.id, item.attributes])

  useEffect(() => {
    const onResize = () => setResizeTick(tick => tick + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const refresh = () => {
    loadPages()
    ctx.refresh()
  }

  const updateVisibility = () => {
    const container = container_ref.current
    if (container !== null && pages !== null) {
      const rect = container.getBoundingClientRect()
      const over = rect.width * 2
      const imgs = container.querySelectorAll<HTMLImageElement>('img.manga-page')
      let changed = false
      const new_srcs = { ...loaded_srcs }
      imgs.forEach(img => {
        const page_id = Number(img.dataset['pageId'])
        if (!loaded_ref.current.has(page_id)) {
          const ir = img.getBoundingClientRect()
          if (ir.right > rect.left - over && ir.left < rect.right + over) {
            const page = pages.find(p => p.id === page_id)
            if (page !== undefined) {
              loaded_ref.current.add(page_id)
              new_srcs[page_id] = page.src
              changed = true
            }
          }
        }
      })
      if (changed) {setLoadedSrcs(new_srcs)}
    }
  }

  useEffect(() => {
    if (pages !== null) {
      const container = container_ref.current
      if (container !== null) {
        const index = Math.min(readProgress(item), Math.max(0, pages.length - 1))
        const target = container.querySelector<HTMLImageElement>(`img[data-page-id="${pages[index]?.id}"]`)
        if (target !== null) {
          container.scrollLeft = direction === 'rtl'
            ? container.scrollWidth - target.offsetLeft - target.clientWidth
            : target.offsetLeft
        }
      }
      updateVisibility()
    }
  }, [pages, direction])

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      const container = container_ref.current
      if (container !== null) {
        const step = window.innerWidth * 0.9
        if (ev.key === 'ArrowRight') {
          container.scrollBy({ left: direction === 'rtl' ? -step : step })
        } else if (ev.key === 'ArrowLeft') {
          container.scrollBy({ left: direction === 'rtl' ? step : -step })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [direction])

  const toggleDirection = () => {
    const next = direction === 'rtl' ? 'ltr' : 'rtl'
    ctx.api.rpc.updateItem({
      id: item.id,
      data: { attributes: { ...item.attributes, reading_direction: next } },
    }).then(() => {
      setDirection(next)
      ctx.refresh()
    }).catch(err => ctx.showError(err instanceof Error ? err.message : String(err)))
  }

  const removePage = (page_id: ItemID) => {
    ctx.api.rpc.deleteItem({ id: page_id }).then(refresh)
      .catch(err => ctx.showError(err instanceof Error ? err.message : String(err)))
  }

  const swapOrder = (page_id: ItemID, other_id: ItemID) => {
    if (pages !== null) {
      const a = pages.find(p => p.id === page_id)
      const b = pages.find(p => p.id === other_id)
      if (a !== undefined && b !== undefined) {
        Promise.all([
          ctx.api.rpc.updateItem({ id: a.id, data: { order_index: b.order_index } }),
          ctx.api.rpc.updateItem({ id: b.id, data: { order_index: a.order_index } }),
        ]).then(refresh).catch(err => ctx.showError(err instanceof Error ? err.message : String(err)))
      }
    }
  }

  const page_width = (page: MangaPage): number => {
    if (page.height <= 0 || page.width <= 0) {
      return 0
    } else {
      return window.innerHeight * (page.width / page.height)
    }
  }

  return (
    <div className="manga-reader-wrap">
      <div className="manga-toolbar">
        <span className="manga-title">{item.title}</span>
        <button className="button" onClick={() => file_input_ref.current?.click()}>
          ＋ 添加页
        </button>
        <input
          ref={file_input_ref}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={ev => {
            const files = [...(ev.target.files ?? [])]
            ev.target.value = ''
            ;(async () => {
              for (const file of files) {
                try {
                  await createImageItem({ api: ctx.api, file, parent_id: item.id })
                } catch (err) {
                  ctx.showError(err instanceof Error ? err.message : String(err))
                }
              }
              refresh()
            })()
          }}
        />
        <button className="button" onClick={toggleDirection}>
          阅读方向: {direction === 'rtl' ? '右→左' : '左→右'}
        </button>
        <button className="button" onClick={updateVisibility}>刷新</button>
      </div>
      <div
        className="manga-reader"
        ref={container_ref}
        onScroll={ev => {
          updateVisibility()
          if (pages !== null && pages.length !== 0) {
            const container = ev.currentTarget
            const mid = container.scrollLeft + container.clientWidth / 2
            let best = 0
            let best_dist = Infinity
            pages.forEach((page, index) => {
              const img = container.querySelector<HTMLImageElement>(`img[data-page-id="${page.id}"]`)
              if (img !== null) {
                const center = img.offsetLeft + img.clientWidth / 2
                const dist = Math.abs(center - mid)
                if (dist < best_dist) {
                  best_dist = dist
                  best = index
                }
              }
            })
            setCurrentIndex(best)
            writeProgress(item, best)
          }
        }}
        style={{ flexDirection: direction === 'rtl' ? 'row-reverse' : 'row' }}
      >
        {pages === null ? (
          <div className="loading">加载中…</div>
        ) : pages.length === 0 ? (
          <div className="manga-empty">
            <div>还没有页面</div>
            <button className="button" onClick={() => file_input_ref.current?.click()}>
              添加第一页
            </button>
          </div>
        ) : (
          pages.map((page, idx) => (
            <div key={page.id} className="manga-page-wrap" data-resize={resize_tick}>
              <img
                className="manga-page"
                data-page-id={page.id}
                src={loaded_srcs[page.id] ?? TRANSPARENT_PIXEL}
                style={{ width: `${page_width(page)}px`, height: '100vh' }}
                alt=""
              />
              <div className="manga-page-tools">
                <button
                  className="tool-button light"
                  disabled={idx === 0}
                  onClick={() => {
                    const prev_page = pages[idx - 1]
                    if (prev_page !== undefined) {swapOrder(page.id, prev_page.id)}
                  }}
                >←</button>
                <button
                  className="tool-button light"
                  disabled={idx === pages.length - 1}
                  onClick={() => {
                    const next_page = pages[idx + 1]
                    if (next_page !== undefined) {swapOrder(page.id, next_page.id)}
                  }}
                >→</button>
                <button
                  className="tool-button light"
                  onClick={() => removePage(page.id)}
                >✕</button>
              </div>
            </div>
          ))
        )}
        <div className="manga-page-indicator">{current_index + 1} / {pages?.length ?? 0}</div>
      </div>
    </div>
  )
}

export const __MANGA_MODULE__: ItemModule = {
  kind: 'manga',
  Presenter: {
    card: (item, ctx) => <MangaCard item={item} ctx={ctx} />,
    full: (item, ctx) => <MangaReader item={item} ctx={ctx} />,
  },
  inlineIcon: (item, ctx) => <MangaInline item={item} ctx={ctx} />,
  inlineMeta: () => <>漫画</>,
}
