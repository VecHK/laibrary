import { Item } from '@laibrary/types'
import { getRpc } from '../lib/rpc'

let __tags__: Item[] = []
let __map__ = new Map<number, string>()
let __loaded__ = false

export function tagsLoaded(): boolean {
  return __loaded__
}

export function allTags(): Item[] {
  return __tags__
}

export function getTagTitle(tag_id: number): string | undefined {
  return __map__.get(tag_id)
}

export function resolveTypeTagId(tag_name: string): number | undefined {
  return __tags__.find(t => t.title === tag_name)?.id
}

export async function loadTags(): Promise<void> {
  const tags = await getRpc().listing({
    limit: 0,
    filter_rules: [{ name: 'role', input: 'tag', logic: 'and' }],
  })
  __tags__ = tags
  __map__ = new Map(tags.map(t => [t.id, t.title]))
  __loaded__ = true
}

export function invalidateTags(): void {
  __loaded__ = false
  __tags__ = []
  __map__.clear()
}
