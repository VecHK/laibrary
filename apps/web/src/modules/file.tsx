import type { Item } from '@laibrary/types'
import type { ItemModule, ViewerCtx } from './types'
import { blobUrl } from '../lib/blob'
import { openItem } from '../lib/open-item'

function filenameOf(item: Item): string {
  const attrs = item.attributes as Record<string, unknown>
  return typeof attrs['filename'] === 'string' ? attrs['filename'] : item.title
}

function FileCard({ item }: { item: Item }) {
  return (
    <div className="card file-card">
      <div className="card-icon">📎</div>
      <div className="card-title">{item.title || filenameOf(item)}</div>
      <div className="card-sub">{item.blob?.mime ?? ''}</div>
    </div>
  )
}

function FileBlock({ item, ctx }: { item: Item; ctx: ViewerCtx }) {
  return (
    <div className="block-file" onClick={() => openItem(item, ctx)}>
      <span className="block-file-icon">📎</span>
      <span className="block-file-name">{filenameOf(item)}</span>
      <span className="block-file-meta">{item.blob?.mime ?? ''}</span>
    </div>
  )
}

function FileFull({ item }: { item: Item }) {
  const src = item.blob === null ? null : blobUrl(item.blob.id)
  return (
    <div className="panel">
      <div className="panel-title">{item.title}</div>
      <table className="meta-table">
        <tbody>
          <tr><th>文件名</th><td>{filenameOf(item)}</td></tr>
          <tr><th>MIME</th><td>{item.blob?.mime ?? ''}</td></tr>
          <tr><th>大小</th><td>{item.blob !== null ? `${item.blob.size} 字节` : ''}</td></tr>
        </tbody>
      </table>
      {src !== null && (
        <a className="button" href={src} download={filenameOf(item)}>下载</a>
      )}
    </div>
  )
}

export const fileModule: ItemModule = {
  role: 'file',
  Presenter: {
    card: item => <FileCard item={item} />,
    full: item => <FileFull item={item} />,
  },
  Block: (item, ctx) => <FileBlock item={item} ctx={ctx} />,
}
