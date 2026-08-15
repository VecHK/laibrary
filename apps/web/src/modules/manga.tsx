import { useEffect, useRef, useState } from 'react'
import { Item } from '@laibrary/types'
import { getRpc } from '../lib/rpc'
import type { ItemModule, ViewerCtx } from './types'
import { fileUrl, uploadImageFile } from './helpers'

type MangaPage = {
  id: number
  src: string
  width: number
  height: number
  order_index: number
}

function readingDirectionOf(item: Item): 'rtl' | 'ltr' {
  const attrs = item.attributes as Record<string, unknown>
  return attrs['reading_direction'] === 'ltr' ? 'ltr' : 'rtl'
}

function MangaCard({ item }: { item: Item }) {
  return (
    <div className="card manga-card">
      <div className="card-icon">📖</div>
      <div className="card-title">{item.title || '(漫画)'}</div>
      <div className="card-sub">漫画 · {readingDirectionOf(item) === 'rtl' ? '右开' : '左开'}</div>
    </div>
  )
}

function MangaReader({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  const [pages, setPages] = useState<MangaPage[] | null>(null)
  const [direction, setDirection] = useState<'rtl' | 'ltr'>(readingDirectionOf(item))
  const [loaded_srcs, setLoadedSrcs] = useState<Record<number, string>>({})
  const container_ref = useRef<HTMLDivElement>(null)
  const loaded_ref = useRef(new Set<number>())
  const file_input_ref = useRef<HTMLInputElement>(null)

  const loadPages = () => {
    getRpc().listing({
      limit: 0,
      sort_by: 'order_index',
      filter_rules: [
        { name: 'parent', input: item.id, logic: 'and' },
        { name: 'role', input: 'image', logic: 'and' },
      ],
    }).then(children => {
      setPages(children.map(child => {
        const attrs = child.attributes as Record<string, unknown>
        const src = attrs['src']
        return {
          id: child.id,
          src: (typeof src === 'string') ? fileUrl(src) : '',
          width: Number(attrs['image_width'] ?? 0),
          height: Number(attrs['image_height'] ?? 0),
          order_index: child.order_index,
        }
      }))
      loaded_ref.current.clear()
      setLoadedSrcs({})
    }).catch(err => {
      ctx.showError(err instanceof Error ? err.message : String(err))
    })
  }

  useEffect(loadPages, [item.id])

  const refresh = () => {
    loadPages()
    ctx.refresh()
  }

  const updateVisibility = () => {
    const container = container_ref.current
    if (container === null || pages === null) {
      return
    }
    const rect = container.getBoundingClientRect()
    const over = rect.width * 2
    const imgs = container.querySelectorAll<HTMLImageElement>('img.manga-page')

    let changed = false
    const new_srcs = { ...loaded_srcs }
    imgs.forEach(img => {
      const page_id = Number(img.dataset['pageId'])
      if (loaded_ref.current.has(page_id)) {
        return
      }
      const ir = img.getBoundingClientRect()
      const visible = (
        (ir.right > (rect.left - over)) &&
        (ir.left < (rect.right + over))
      )
      if (visible) {
        const page = pages.find(p => p.id === page_id)
        if (page !== undefined) {
          loaded_ref.current.add(page_id)
          new_srcs[page_id] = page.src
          changed = true
        }
      }
    })
    if (changed) {
      setLoadedSrcs(new_srcs)
    }
  }

  useEffect(() => {
    if (pages !== null) {
      const container = container_ref.current
      if (container !== null) {
        container.scrollLeft = direction === 'rtl' ? container.scrollWidth : 0
      }
      updateVisibility()
    }
  }, [pages, direction])

  const toggleDirection = () => {
    const next_direction = direction === 'rtl' ? 'ltr' : 'rtl'
    getRpc().updateItem({
      id: item.id,
      data: { attributes: { ...item.attributes, reading_direction: next_direction } as never },
    }).then(() => {
      setDirection(next_direction)
      ctx.refresh()
    }).catch(err => {
      ctx.showError(err instanceof Error ? err.message : String(err))
    })
  }

  const removePage = (page_id: number) => {
    getRpc().deleteItem({ id: page_id }).then(() => refresh()).catch(err => {
      ctx.showError(err instanceof Error ? err.message : String(err))
    })
  }

  const swapOrder = (page_id: number, other_id: number) => {
    if (pages === null) {
      return
    }
    const a = pages.find(p => p.id === page_id)
    const b = pages.find(p => p.id === other_id)
    if (a === undefined || b === undefined) {
      return
    }
    Promise.all([
      getRpc().updateItem({ id: a.id, data: { order_index: b.order_index } }),
      getRpc().updateItem({ id: b.id, data: { order_index: a.order_index } }),
    ]).then(() => refresh()).catch(err => {
      ctx.showError(err instanceof Error ? err.message : String(err))
    })
  }

  const page_width = (page: MangaPage): number => {
    if (page.height <= 0 || page.width <= 0) {
      return 0
    }
    return window.innerHeight * (page.width / page.height)
  }

  return (
    <div className="manga-reader-wrap">
      <div className="manga-toolbar">
        <button
          className="button"
          onClick={() => {
            if (item.parent_id !== null) {
              ctx.navigate(item.parent_id)
            }
          }}
        >← 返回</button>
        <span className="manga-title">{item.title}</span>
        <button
          className="button"
          onClick={() => file_input_ref.current?.click()}
        >＋ 添加页</button>
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
                await uploadImageFile(file, item.id, () => {}, ctx.showError)
              }
              refresh()
            })()
          }}
        />
        <button className="button" onClick={toggleDirection}>
          阅读方向: {direction === 'rtl' ? '右→左' : '左→右'}
        </button>
      </div>
      <div
        className="manga-reader"
        ref={container_ref}
        onScroll={updateVisibility}
        style={{ flexDirection: direction === 'rtl' ? 'row-reverse' : 'row' }}
      >
        {pages === null ? (
          <div className="loading">加载中…</div>
        ) : (
          pages.length === 0 ? (
            <div className="manga-empty">
              <div>还没有页面</div>
              <button className="button" onClick={() => file_input_ref.current?.click()}>
                添加第一页
              </button>
            </div>
          ) : (
            pages.map((page, idx) => (
              <div key={page.id} className="manga-page-wrap">
                <img
                  className="manga-page"
                  data-page-id={page.id}
                  src={loaded_srcs[page.id] ?? ''}
                  style={{ width: `${page_width(page)}px`, height: '100vh' }}
                  alt=""
                />
                <div className="manga-page-tools">
                  <button
                    className="tool-button light"
                    title="前移"
                    disabled={idx === 0}
                    onClick={() => swapOrder(page.id, pages[idx - 1]!.id)}
                  >←</button>
                  <button
                    className="tool-button light"
                    title="后移"
                    disabled={idx === pages.length - 1}
                    onClick={() => swapOrder(page.id, pages[idx + 1]!.id)}
                  >→</button>
                  <button
                    className="tool-button light"
                    title="删除本页"
                    onClick={() => removePage(page.id)}
                  >✕</button>
                </div>
              </div>
            ))
          )
        )}
      </div>
    </div>
  )
}

export const mangaModule: ItemModule = {
  tag: 'sys/type/manga',
  Presenter: {
    card: (item) => <MangaCard item={item} />,
    full: (item, ctx) => <MangaReader item={item} ctx={ctx} />,
  },
}
