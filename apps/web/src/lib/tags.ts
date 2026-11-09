import { useEffect, useState } from 'react'
import { Signal } from 'vait'
import type { Item, ItemID, RpcClient } from '@laibrary/types'

export type TagStore = {
  readonly sig_tags_changed: Signal<void>
  readonly load: () => Promise<void>
  readonly invalidate: () => void
  readonly isLoaded: () => boolean
  readonly all: () => readonly Item[]
  readonly titleOf: (tag_id: ItemID) => string | null
}

export type CreateTagStoreOptions = {
  rpc: RpcClient
}

export function CreateTagStore({ rpc }: CreateTagStoreOptions): TagStore {
  let __tags: readonly Item[] = []
  let __map = new Map<ItemID, string>()
  let __loaded = false
  const sig_tags_changed = Signal<void>()

  const load = async (): Promise<void> => {
    const tags = await rpc.listing({
      limit: 0,
      filter_rules: [{ name: 'role', input: 'tag', logic: 'and' }],
    })
    __tags = tags
    __map = new Map(tags.map(tag => [tag.id, tag.title]))
    __loaded = true
    sig_tags_changed.trigger()
  }

  const invalidate = (): void => {
    __loaded = false
    __tags = []
    __map.clear()
    sig_tags_changed.trigger()
  }

  return {
    sig_tags_changed,
    load,
    invalidate,
    isLoaded: () => __loaded,
    all: () => __tags,
    titleOf: tag_id => __map.get(tag_id) ?? null,
  }
}

export function useTagStoreVersion(store: TagStore | null): number {
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (store === null) {
      return undefined
    } else {
      const off = store.sig_tags_changed.receive(() => {
        setVersion(current => current + 1)
      })
      return off
    }
  }, [store])

  return version
}
