import { describe, expect, it, vi } from 'vitest'
import type { Item, RpcClient } from '@laibrary/types'
import { CreateTagStore } from '../src/lib/tags'

function tag(id: number, title: string): Item {
  return {
    id: id as Item['id'],
    role: 'tag',
    kind: null,
    unity_name: null,
    title,
    attributes: {},
    tags: [],
    parent_id: null,
    order_index: id,
    blob: null,
    target_id: null,
    create_date: '',
    update_date: '',
  }
}

describe('CreateTagStore', () => {
  it('loads tags, maps titles, and emits changes', async () => {
    const listing = vi.fn(async () => [tag(1, 'a'), tag(2, 'b')])
    const rpc = { listing } as unknown as RpcClient
    const store = CreateTagStore({ rpc })
    const received = vi.fn()
    const off = store.sig_tags_changed.receive(received)

    expect(store.isLoaded()).toBe(false)
    await store.load()
    expect(store.isLoaded()).toBe(true)
    expect(store.all()).toHaveLength(2)
    expect(store.titleOf(tag(1, '').id)).toBe('a')
    expect(received).toHaveBeenCalledTimes(1)

    store.invalidate()
    expect(store.isLoaded()).toBe(false)
    expect(store.all()).toHaveLength(0)
    expect(store.titleOf(tag(1, '').id)).toBeNull()
    expect(received).toHaveBeenCalledTimes(2)
    off()
  })
})
