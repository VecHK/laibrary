import type { ItemID } from './roles'
import { as } from './as'

export type ItemToken =
  | { type: 'text'; text: string }
  | { type: 'item'; target_id: ItemID; label: string | null; raw: string }

const TOKEN_PATTERN = /(?<!\\)\[\[item:(\d+)(?:\|([^\]]*))?\]\]/g

export function formatItemToken(
  target_id: ItemID,
  label: string | null,
): string {
  if (label !== null && label.length > 0) {
    return `[[item:${target_id}|${label}]]`
  }
  return `[[item:${target_id}]]`
}

/** Split a plain-text block into text and inline item-link tokens. */
export function parseItemTokens(text: string): ItemToken[] {
  const tokens: ItemToken[] = []
  let cursor = 0
  TOKEN_PATTERN.lastIndex = 0

  let match = TOKEN_PATTERN.exec(text)
  while (match !== null) {
    const index = match.index
    if (index > cursor) {
      tokens.push({ type: 'text', text: text.slice(cursor, index) })
    }

    const raw_id = match[1] ?? ''
    const id = Number.parseInt(raw_id, 10)
    if (Number.isSafeInteger(id) && id > 0) {
      tokens.push({
        type: 'item',
        target_id: as<ItemID>(id),
        label: match[2] === undefined || match[2].length === 0 ? null : match[2],
        raw: match[0],
      })
    } else {
      tokens.push({ type: 'text', text: match[0] })
    }

    cursor = index + match[0].length
    match = TOKEN_PATTERN.exec(text)
  }

  if (cursor < text.length) {
    tokens.push({ type: 'text', text: text.slice(cursor) })
  }
  return tokens
}

export function extractItemTokenIds(text: string): ItemID[] {
  const ids = new Set<ItemID>()
  for (const token of parseItemTokens(text)) {
    if (token.type === 'item') {
      ids.add(token.target_id)
    }
  }
  return [...ids]
}

export function unescapeItemTokenText(text: string): string {
  return text.replace(/\\\[\[/g, '[[')
}
