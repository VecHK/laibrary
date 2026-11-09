import type { ReactNode } from 'react'
import type { Item, ItemID, Role, RpcClient } from '@laibrary/types'
import type { HashRoute } from '../lib/hash-router'
import type { TagStore } from '../lib/tags'

export type ApiContext = {
  readonly base_url: string
  readonly rpc: RpcClient
}

export type ItemModuleRegistry = {
  readonly resolve: (item: Item) => ItemModule
  readonly getKind: (kind: string) => ItemModule | undefined
}

export interface ViewerCtx {
  readonly api: ApiContext
  readonly tags: TagStore
  readonly modules: ItemModuleRegistry
  readonly navigate: (target: ItemID | HashRoute) => void
  readonly refresh: () => void
  readonly refreshSidebar: () => void
  readonly showError: (message: string) => void
  readonly showNotice: (message: string) => void
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
