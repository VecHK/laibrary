import type { Item, ListKind } from '@laibrary/types'
import { zTextListAttributes, zTextTodoAttributes } from '@laibrary/types'

export function listKindOf(item: Item): ListKind {
  if (item.role !== 'text-list') {
    return 'bullet'
  } else {
    const parsed = zTextListAttributes.safeParse(item.attributes)
    const kind = parsed.success ? parsed.data.list_kind : undefined
    if (kind === 'number' || kind === 'alpha' || kind === 'bullet') {
      return kind
    } else {
      return 'bullet'
    }
  }
}

export function alphaLabel(count: number): string {
  let $remaining = Math.max(1, count)
  let $label = ''
  while ($remaining > 0) {
    $remaining -= 1
    $label = String.fromCharCode(97 + ($remaining % 26)) + $label
    $remaining = Math.floor($remaining / 26)
  }
  return $label
}

export function listMarkerFor(list: readonly Item[], index: number): string | null {
  const current = list[index]
  if (current === undefined || current.role !== 'text-list') {
    return null
  } else {
    const kind = listKindOf(current)
    if (kind === 'bullet') {
      return '•'
    } else {
      let $count = 1
      let $cursor = index - 1
      while ($cursor >= 0) {
        const previous = list[$cursor]
        if (previous !== undefined && previous.role === 'text-list' && listKindOf(previous) === kind) {
          $count += 1
          $cursor -= 1
        } else {
          $cursor = -1
        }
      }
      return kind === 'number' ? `${$count}.` : `${alphaLabel($count)}.`
    }
  }
}


export function todoCheckedOf(item: Item): boolean {
  if (item.role !== 'text-todo') {
    return false
  } else {
    const parsed = zTextTodoAttributes.safeParse(item.attributes)
    return parsed.success && parsed.data.checked === true
  }
}
