import { Item } from '@laibrary/types'
import type { ItemModule } from './types'
import { fileUrl } from './helpers'

function imageSrcOf(item: Item): string | null {
  const attrs = item.attributes as Record<string, unknown>
  const src = (
    (typeof attrs['cover_src'] === 'string' && attrs['cover_src'].length > 0)
  ) ? attrs['cover_src'] : attrs['src']
  return (typeof src === 'string' && src.length > 0) ? fileUrl(src) : null
}

function ImageCard({ item }: { item: Item }) {
  const src = imageSrcOf(item)
  return (
    <div className="card image-card">
      {src !== null ? (
        <img className="image-card-img" src={src} alt={item.title} loading="lazy" />
      ) : (
        <div className="card-icon">🖼️</div>
      )}
      <div className="card-title">{item.title || '(图片)'}</div>
    </div>
  )
}

function ImageFull({ item, ctx }: { item: Item; ctx: import('./types').ViewerCtx }) {
  const src = imageSrcOf(item)
  return (
    <div className="image-full" onClick={() => ctx.navigate(item.parent_id ?? item.id)}>
      <div className="image-full-bar">
        <span className="image-full-title">{item.title}</span>
        <button className="button" onClick={ev => {
          ev.stopPropagation()
          if (item.parent_id !== null) {
            ctx.navigate(item.parent_id)
          }
        }}>返回</button>
      </div>
      {src !== null ? (
        <img className="image-full-img" src={src} alt={item.title} />
      ) : (
        <div className="empty-hint">图片文件缺失</div>
      )}
    </div>
  )
}

export const imageModule: ItemModule = {
  role: 'image',
  Presenter: {
    card: (item) => <ImageCard item={item} />,
    full: (item, ctx) => <ImageFull item={item} ctx={ctx} />,
  },
}
