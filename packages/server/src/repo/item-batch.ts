import { eq, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { Item, ItemID } from '@laibrary/types'
import { zItemID, zAnyAttributes } from '@laibrary/types'
import type { DbLike } from '../db/client'
import { blobs, items } from '../db/schema'
import { errorsBadRequest, errorsConflict, errorsNotFound } from '../errors'
import { writeRun, type WriteResult } from '../write-result'
import { getItems } from './items'
import { toWireItem } from './wire'

const zSubtreeRow = z.object({
  id: z.coerce.number().pipe(zItemID),
  depth: z.coerce.number().int().nonnegative(),
})

function isSystemUnityName(unity_name: string | null): boolean {
  return unity_name !== null && unity_name.startsWith('sys.')
}

function uniqueIds(ids: readonly ItemID[]): ItemID[] {
  return [...new Set(ids)]
}

export async function deleteItems(
  db: DbLike,
  ids: readonly ItemID[],
): Promise<WriteResult<Item[]>> {
  return writeRun(async () => {
    const roots = uniqueIds(ids)
    if (roots.length === 0) {
      return []
    } else {
      const subtree_result = await db.execute(sql`
        WITH RECURSIVE subtree AS (
          SELECT id, 0 AS depth FROM items WHERE ${inArray(items.id, roots)}
          UNION ALL
          SELECT child.id, subtree.depth + 1
          FROM items child
          JOIN subtree ON child.parent_id = subtree.id
        )
        SELECT id, depth FROM subtree ORDER BY depth DESC, id DESC
      `)
      const subtree = z.array(zSubtreeRow).parse(subtree_result.rows)

      for (const root of roots) {
        if (!subtree.some(row => row.id === root)) {
          throw errorsNotFound(`item(id=${root}) not found`)
        }
      }

      const found_rows = await db
                              .select({ item: items, blob: blobs })
                              .from(items)
                              .leftJoin(blobs, eq(items.blob_id, blobs.id))
                              .where(inArray(items.id, subtree.map(row => row.id)))
      if (found_rows.length !== subtree.length) {
        throw errorsNotFound('删除目标中包含不存在的 item')
      }

      const snapshots = found_rows.map(row => toWireItem(row.item, row.blob))
      const blocked = snapshots.find(item => (
        item.role === 'tag' || isSystemUnityName(item.unity_name)
      ))
      if (blocked !== undefined) {
        throw errorsBadRequest(`item(${blocked.id}) 是 tag 或系统项，不能批量删除`)
      }

      const depths = [...new Set(subtree.map(row => row.depth))].toSorted((a, b) => b - a)
      for (const depth of depths) {
        const group = subtree.filter(row => row.depth === depth).map(row => row.id)
        await db.delete(items).where(inArray(items.id, group))
      }

      return snapshots
    }
  })
}

function itemDepth(item: Item, $by_id: ReadonlyMap<ItemID, Item>, $seen: Set<ItemID>): number {
  if ($seen.has(item.id)) {
    throw errorsConflict('恢复快照中存在父子环')
  } else if (item.parent_id === null || !$by_id.has(item.parent_id)) {
    return 0
  } else {
    const parent = $by_id.get(item.parent_id)
    if (parent === undefined) {
      return 0
    } else {
      $seen.add(item.id)
      return 1 + itemDepth(parent, $by_id, $seen)
    }
  }
}

export async function restoreItems(
  db: DbLike,
  snapshots: readonly Item[],
): Promise<WriteResult<Item[]>> {
  return writeRun(async () => {
    if (snapshots.length === 0) {
      return []
    } else {
      const $by_id = new Map<ItemID, Item>()
      for (const snapshot of snapshots) {
        if ($by_id.has(snapshot.id)) {
          throw errorsConflict(`恢复快照中 id 重复: ${snapshot.id}`)
        } else if (snapshot.role === 'tag' || isSystemUnityName(snapshot.unity_name)) {
          throw errorsBadRequest(`item(${snapshot.id}) 是 tag 或系统项，不能批量恢复`)
        } else {
          $by_id.set(snapshot.id, snapshot)
        }
      }

      const existing = await db
                              .select({ id: items.id })
                              .from(items)
                              .where(inArray(items.id, [...$by_id.keys()]))
      if (existing.length !== 0) {
        throw errorsConflict(`恢复 ID 已被占用: ${existing.map(row => row.id).join(', ')}`)
      }

      const ordered = [...snapshots].toSorted((left, right) => (
        itemDepth(left, $by_id, new Set()) - itemDepth(right, $by_id, new Set())
      ))

      for (const snapshot of ordered) {
        const attributes = zAnyAttributes.parse(snapshot.attributes)
        await db.execute(sql`
          INSERT INTO items (
            id, role, kind, unity_name, title, attributes,
            parent_id, order_index, blob_id, target_id, create_date, update_date
          ) VALUES (
            ${snapshot.id}, ${snapshot.role}, ${snapshot.kind}, ${snapshot.unity_name},
            ${snapshot.title}, ${JSON.stringify(attributes)}::jsonb,
            ${snapshot.parent_id}, ${snapshot.order_index}, ${snapshot.blob?.id ?? null},
            ${snapshot.target_id}, ${new Date(snapshot.create_date)}, ${new Date(snapshot.update_date)}
          )
        `)
        await db.update(items).set({ tags: [...snapshot.tags] }).where(eq(items.id, snapshot.id))
      }

      return getItems(db, [...$by_id.keys()])
    }
  })
}
