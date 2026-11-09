import type { ItemID } from '@laibrary/types'
import { hashRouteTo } from './hash-router'

export function itemHash(id: ItemID): string {
  return hashRouteTo({ name: 'item', id })
}

export function itemUrl(id: ItemID): string {
  return `${window.location.origin}${window.location.pathname}${itemHash(id)}`
}
