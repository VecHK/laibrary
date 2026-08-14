import { eq } from 'drizzle-orm'
import { Item, ItemID, Role, RoleAttributes } from '@laibrary/types'
import type { DB } from '../db/client'
import { items, type ItemRow } from '../db/schema'

export function toWireItem(row: ItemRow): Item {
  return {
    id: row.id,
    role: row.role as Role,
    title: row.title,
    attributes: row.attributes as RoleAttributes[Role],
    tags: row.tags ?? [],
    parent_id: row.parent_id,
    order_index: row.order_index,
    create_date: row.create_date.toISOString(),
    update_date: row.update_date.toISOString(),
  }
}

export async function getItemRow(db: DB, id: ItemID): Promise<ItemRow> {
  const rows = await db.select().from(items).where(eq(items.id, id)).limit(1)
  const row = rows[0]
  if (row === undefined) {
    throw new Error(`item(id=${id}) not found`)
  } else {
    return row
  }
}

export async function findItemRow(db: DB, id: ItemID): Promise<ItemRow | null> {
  const rows = await db.select().from(items).where(eq(items.id, id)).limit(1)
  return rows[0] ?? null
}
