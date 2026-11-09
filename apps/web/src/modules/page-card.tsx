import type { Item } from '@laibrary/types'

export function PageCard({ item }: { item: Item }) {
  return (
    <div className="card page-card">
      <div className="card-icon">📄</div>
      <div className="card-title">{item.title || '(无标题)'}</div>
    </div>
  )
}
