import type { Item } from '@laibrary/types'
import type { ItemModule, ViewerCtx } from './types'
import { blobUrl, thumbUrl } from '../lib/blob'
import { openItem } from '../lib/open-item'

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

function ImageBlock({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  return (
    <div className="block-image" onClick={() => openItem(item, ctx)}>
      {item.blob !== null ? (
        <img src={thumbUrl(ctx.api.base_url, item.id, 384)} alt={item.title} loading="lazy" />
      ) : (
        <div className="empty-hint">图片缺失</div>
      )}
      <div className="block-caption">{item.title || '(图片)'}</div>
    </div>
  )
}

function ImageFull({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  const src = item.blob === null ? null : blobUrl(ctx.api.base_url, item.blob.id)
  return (
    <div className="image-full" onClick={() => ctx.navigate(item.parent_id ?? item.id)}>
      <div className="image-full-bar">
        <span className="image-full-title">{item.title}</span>
        <button
          className="button"
          onClick={ev => {
            ev.stopPropagation()
            if (item.parent_id !== null) {ctx.navigate(item.parent_id)}
          }}
        >返回</button>
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
