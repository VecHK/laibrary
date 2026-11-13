import { asc, eq, sql } from 'drizzle-orm'
import type { Item, ItemID } from '@laibrary/types'
import { as, itemCheckAttributes } from '@laibrary/types'
import type { DbLike } from '../db/client'
import { items, type ItemRow } from '../db/schema'
import { errorsBadRequest, errorsConflict, errorsNotFound, errorsPgCode } from '../errors'
import { writeRun, type WriteResult } from '../write-result'
import {
  getItemRowForUpdate, getWireItem,
} from './wire'

function tagWire(row: ItemRow): Item {
  return {
    id: row.id,
    role: 'tag',
    kind: null,
    unity_name: null,
    title: row.title,
    attributes: row.attributes,
    tags: row.tags ?? [],
    parent_id: row.parent_id,
    order_index: row.order_index,
    blob: null,
    target_id: null,
    create_date: row.create_date.toISOString(),
    update_date: row.update_date.toISOString(),
  }
}

export async function newTag(
  db: DbLike,
  title: string,
  attributes: Record<string, unknown> = {},
): Promise<WriteResult<Item>> {
  return writeRun(async () => {
    if (title.length === 0) {
      throw errorsBadRequest('不能设置空 tag 名')
    } else {
      const parsed_attrs = itemCheckAttributes('tag', attributes)

      await db.execute(sql`
        INSERT INTO items (role, title, attributes)
        VALUES ('tag', ${title}, ${parsed_attrs})
        ON CONFLICT (lower(title)) WHERE role = 'tag'
        DO UPDATE SET update_date = now()
      `)

      const found = await getTagByTitle(db, title)
      if (found === null) {
        throw new Error('newTag 失败')
      } else {
        return found
      }
    }
  })
}

async function duplicateTagName(db: DbLike, item_id: ItemID, tagname: string): Promise<boolean> {
  return (
    await db
          .select({ id: items.id })
          .from(items)
          .where(sql`${items.role} = 'tag' and lower(${items.title}) = lower(${tagname}) and ${items.id} <> ${item_id}`)
          .limit(1)
  ).length !== 0
}

export async function updateTag(
  db: DbLike,
  id: ItemID,
  data: { title?: string | undefined, attributes?: Record<string, unknown> | undefined },
): Promise<WriteResult<Item>> {
  return writeRun(async () => {
    const prev = await getItemRowForUpdate(db, id)
    if (prev.role !== 'tag') {
      throw errorsBadRequest(`item(id=${id}) 并不是 tag`)
    }

    const new_title = data.title ?? prev.title
    if (new_title.length === 0) {
      throw errorsBadRequest('不能设置空 tag 名')
    } else if (data.title !== undefined) {
      if (await duplicateTagName(db, id, new_title)) {
        throw errorsConflict(`重复的 tag 名: ${new_title}`)
      }
    }

    try {
      const [row] = (
        await db
              .update(items)
              .set({
                title: new_title,
                attributes: (
                  data.attributes !== undefined
                  ? as<Record<string, unknown>>(itemCheckAttributes('tag', data.attributes))
                  : prev.attributes
                ),
                update_date: new Date(),
              })
              .where(eq(items.id, id))
              .returning()
      )
      if (row === undefined) {
        throw errorsNotFound(`item(id=${id}) not found`)
      } else {
        return await getWireItem(db, row.id)
      }
    } catch (err) {
      if (errorsPgCode(err) === '23505') {
        throw errorsConflict(`重复的 tag 名: ${new_title}`)
      } else {
        throw err
      }
    }
  })
}

function hasChildrenTag(db: DbLike, id: ItemID): Promise<boolean> {
  return db
          .select({ id: items.id })
          .from(items)
          .where(eq(items.parent_id, id))
          .limit(1)
          .then(rows => rows.length !== 0)
}

export async function deleteTag(db: DbLike, id: ItemID): Promise<void> {
  const found = await getItemRowForUpdate(db, id)
  if (found.role !== 'tag') {
    throw errorsBadRequest(`item(id=${id}) 并不是 tag`)
  }

  if (await hasChildrenTag(db, id)) {
    throw errorsConflict(`tag(id=${id}) 存在子项，不能删除`)
  }

  await db
        .update(items)
        .set({ tags: sql`array_remove(${items.tags}, ${id})` })
        .where(sql`${id} = ANY(${items.tags})`)

  await db.delete(items).where(eq(items.id, id))
}

export async function searchTag(
  db: DbLike,
  name: string,
  limit: number = 30,
): Promise<Item[]> {
  const query = db
                .select({ item: items })
                .from(items)
                .where(sql`${items.role} = 'tag' and ${items.title} ilike ${`%${name}%`}`)
                .orderBy(asc(items.title))

  if (limit !== 0) {
    query.limit(Math.min(limit, 1000))
  }
  const rows = await query
  return rows.map(row => tagWire(row.item))
}

export async function getTagByTitle(
  db: DbLike,
  title: string,
): Promise<Item | null> {
  const [row] = (
    await db
          .select({ item: items })
          .from(items)
          .where(sql`${items.role} = 'tag' and lower(${items.title}) = lower(${title})`)
          .limit(1)
  )
  return row === undefined ? null : tagWire(row.item)
}
