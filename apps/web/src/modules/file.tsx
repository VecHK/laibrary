import { Item } from '@laibrary/types'
import type { ItemModule } from './types'
import { fileUrl } from './helpers'

function FileCard({ item }: { item: Item }) {
  const attrs = item.attributes as Record<string, unknown>
  const mime = typeof attrs['mime'] === 'string' ? attrs['mime'] : ''
  return (
    <div className="card file-card">
      <div className="card-icon">📎</div>
      <div className="card-title">{item.title || '(文件)'}</div>
      <div className="card-sub">{mime}</div>
    </div>
  )
}

function FileFull({ item }: { item: Item }) {
  const attrs = item.attributes as Record<string, unknown>
  const src = typeof attrs['src'] === 'string' ? attrs['src'] : null
  const filename = typeof attrs['filename'] === 'string' ? attrs['filename'] : item.title
  const size = typeof attrs['size'] === 'number' ? attrs['size'] : null

  return (
    <div className="panel">
      <div className="panel-title">{item.title}</div>
      <table className="meta-table">
        <tbody>
          <tr><th>文件名</th><td>{filename}</td></tr>
          <tr><th>MIME</th><td>{String(attrs['mime'] ?? '')}</td></tr>
          <tr><th>大小</th><td>{size !== null ? `${size} 字节` : ''}</td></tr>
        </tbody>
      </table>
      {src !== null && (
        <a className="button" href={fileUrl(src)} download={filename}>下载</a>
      )}
    </div>
  )
}

export const fileModule: ItemModule = {
  role: 'file',
  Presenter: {
    card: (item) => <FileCard item={item} />,
    full: (item) => <FileFull item={item} />,
  },
}
