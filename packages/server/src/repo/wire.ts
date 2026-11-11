import { eq, inArray } from 'drizzle-orm'
import type { BlobMeta, Item, ItemID } from '@laibrary/types'
import { itemCheckAttributes } from '@laibrary/types'
import { zUnityName } from '@laibrary/types'
import type { DbLike } from '../db/client'
import { blobs, items, type BlobRow, type ItemRow } from '../db/schema'
import { errorsNotFound } from '../errors'

export function blobRowToMeta(row: BlobRow | null): BlobMeta | null {
  if (row === null) {
    return null
  } else {
    return {
      id: row.id,
      size: row.size,
      mime: row.mime,
      width: row.width,
      height: row.height,
    }
  }
}

export function toWireItem(row: ItemRow, blob: BlobRow | null): Item {
  return {
    id: row.id,
    role: row.role,
    kind: row.kind,
    unity_name: row.unity_name,
    title: row.title,
    attributes: itemCheckAttributes(row.role, row.attributes),
    tags: row.tags ?? [],
    parent_id: row.parent_id,
    order_index: row.order_index,
    blob: blobRowToMeta(blob),
    target_id: row.target_id,
    create_date: row.create_date.toISOString(),
    update_date: row.update_date.toISOString(),
  }
}

export async function getItemRow(db: DbLike, id: ItemID): Promise<ItemRow> {
  const rows = await db.select().from(items).where(eq(items.id, id)).limit(1)
  const row = rows[0]
  if (row === undefined) {
    throw errorsNotFound(`item(id=${id}) not found`)
  } else {
    return row
  }
}

export async function getItemRowForUpdate(db: DbLike, id: ItemID): Promise<ItemRow> {
  const rows = await db
    .select()
    .from(items)
    .where(eq(items.id, id))
    .limit(1)
    .for('update')
  const row = rows[0]
  if (row === undefined) {
    throw errorsNotFound(`item(id=${id}) not found`)
  } else {
    return row
  }
}

export async function findItemRow(db: DbLike, id: ItemID): Promise<ItemRow | null> {
  const rows = await db.select().from(items).where(eq(items.id, id)).limit(1)
  return rows[0] ?? null
}

export async function findItemRowByUnityName(
  db: DbLike,
  unity_name: string,
): Promise<ItemRow | null> {
  const rows = await db
    .select()
    .from(items)
    .where(eq(items.unity_name, zUnityName.parse(unity_name)))
    .limit(1)
  return rows[0] ?? null
}

async function selectWithBlob(db: DbLike, id: ItemID) {
  const rows = await db
    .select({ item: items, blob: blobs })
    .from(items)
    .leftJoin(blobs, eq(items.blob_id, blobs.id))
    .where(eq(items.id, id))
    .limit(1)
  const row = rows[0]
  if (row === undefined) {
    throw errorsNotFound(`item(id=${id}) not found`)
  } else {
    return row
  }
}

export async function getWireItem(db: DbLike, id: ItemID): Promise<Item> {
  const row = await selectWithBlob(db, id)
  return toWireItem(row.item, row.blob)
}

export async function getWireItems(db: DbLike, ids: readonly ItemID[]): Promise<Item[]> {
  if (ids.length === 0) {
    return []
  } else {
    const rows = await db
      .select({ item: items, blob: blobs })
      .from(items)
      .leftJoin(blobs, eq(items.blob_id, blobs.id))
      .where(inArray(items.id, ids))
    const map = new Map(rows.map(row => [row.item.id, row]))
    return ids.map(id => {
      const row = map.get(id)
      if (row === undefined) {
        throw errorsNotFound(`item(id=${id}) not found`)
      } else {
        return toWireItem(row.item, row.blob)
      }
    })
  }
}

export async function getWireItemByUnityName(
  db: DbLike,
  unity_name: string,
): Promise<Item | null> {
  const row = await findItemRowByUnityName(db, unity_name)
  if (row === null) {
    return null
  } else {
    return getWireItem(db, row.id)
  }
}
