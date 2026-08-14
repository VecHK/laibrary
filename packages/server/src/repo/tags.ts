import { asc, eq, sql } from 'drizzle-orm'
import {
  Item, ItemID, checkAttributes,
} from '@laibrary/types'
import type { DB } from '../db/client'
import { items, type ItemRow } from '../db/schema'
import { getItemRow, toWireItem } from './wire'

export async function newTag(
  db: DB,
  title: string,
  attributes: Record<string, unknown> = {},
): Promise<Item> {
  if (title.length === 0) {
    throw new Error('不能设置空 tag 名')
  }
  const parsed_attrs = checkAttributes('tag', attributes)

  await db.execute(sql`
    INSERT INTO items (role, title, attributes)
    VALUES ('tag', ${title}, ${parsed_attrs})
    ON CONFLICT (lower(title)) WHERE role = 'tag'
    DO UPDATE SET update_date = now()
  `)

  const found = await getTagByTitle(db, title)
  if (found === null) {
    throw new Error('newTag 失败')
  }
  return found
}

export async function updateTag(
  db: DB,
  id: ItemID,
  data: { title?: string, attributes?: Record<string, unknown> },
): Promise<Item> {
  const prev = await getItemRow(db, id)
  if (prev.role !== 'tag') {
    throw new Error(`item(id=${id}) 并不是 tag`)
  }

  const new_title = data.title ?? prev.title
  if (new_title.length === 0) {
    throw new Error('不能设置空 tag 名')
  }

  if (data.title !== undefined) {
    const dup_rows = await db
      .select({ id: items.id })
      .from(items)
      .where(
        sql`${items.role} = 'tag' and lower(${items.title}) = lower(${new_title}) and ${items.id} <> ${id}`,
      )
      .limit(1)
    if (dup_rows.length !== 0) {
      throw new Error(`重复的 tag 名: ${new_title}`)
    }
  }

  const new_attrs = (
    data.attributes !== undefined
  ) ? (checkAttributes('tag', data.attributes) as unknown as Record<string, unknown>) : prev.attributes

  const new_rows = await db
    .update(items)
    .set({
      title: new_title,
      attributes: new_attrs,
      update_date: new Date(),
    })
    .where(eq(items.id, id))
    .returning()

  return toWireItem(new_rows[0] as ItemRow)
}

export async function deleteTag(db: DB, id: ItemID): Promise<void> {
  const found = await getItemRow(db, id)
  if (found.role !== 'tag') {
    throw new Error(`item(id=${id}) 并不是 tag`)
  }

  const child_rows = await db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.parent_id, id))
    .limit(1)
  if (child_rows.length !== 0) {
    throw new Error(`tag(id=${id}) 存在子项,不能删除`)
  }

  await db
    .update(items)
    .set({ tags: sql`array_remove(${items.tags}, ${id})` })
    .where(sql`${id} = ANY(${items.tags})`)

  await db.delete(items).where(eq(items.id, id))
}

export async function searchTag(
  db: DB,
  name: string,
  limit: number = 30,
): Promise<Item[]> {
  const query = db
    .select()
    .from(items)
    .where(
      sql`${items.role} = 'tag' and ${items.title} ilike ${`%${name}%`}`,
    )
    .orderBy(asc(items.title))

  if (limit !== 0) {
    query.limit(limit)
  }

  const rows = await query
  return rows.map(toWireItem)
}

export async function getTagByTitle(
  db: DB,
  title: string,
): Promise<Item | null> {
  const rows = await db
    .select()
    .from(items)
    .where(
      sql`${items.role} = 'tag' and lower(${items.title}) = lower(${title})`,
    )
    .limit(1)
  const row = rows[0]
  return row === undefined ? null : toWireItem(row)
}
