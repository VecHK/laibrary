import type { ReactNode } from 'react'
import type { Item, ItemID, Role } from '@laibrary/types'
import type { HashRoute } from '../lib/hash-router'

export interface ViewerCtx {
  navigate(target: ItemID | HashRoute): void
  refresh(): void
  showError(message: string): void
}

export interface ItemModule {
  role?: Role
  kind?: string
  Presenter: {
    card: (item: Item, ctx: ViewerCtx) => ReactNode
    full: (item: Item, ctx: ViewerCtx) => ReactNode
  }
  Block?: (item: Item, ctx: ViewerCtx) => ReactNode
  inlineIcon?: (item: Item, ctx: ViewerCtx) => ReactNode
  inlineMeta?: (item: Item, ctx: ViewerCtx) => ReactNode
}
