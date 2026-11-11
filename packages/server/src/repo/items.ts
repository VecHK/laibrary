import { eq, inArray, isNull, max, sql } from 'drizzle-orm'
import type {
  AddItemForm, BlobID, DatabaseFieldDef, Item, ItemID, Role, TextBlockRole, UpdateItemForm,
} from '@laibrary/types'
import {
  __SYSTEM_UNITY_PREFIX__, as, isTextBlockRole, itemBuildRowValidator, itemCheckAttributes, extractItemTokenIds,
  zDatabaseAttributes, zKind, zRole, zUnityName,
} from '@laibrary/types'
import type { DbLike } from '../db/client'
import { items } from '../db/schema'
import { errorsBadRequest, errorsConflict, errorsNotFound, errorsPgCode } from '../errors'
import type { BlobService } from '../blob/service'
import {
  findItemRow, getItemRow, getItemRowForUpdate, getWireItem,
  getWireItemByUnityName, getWireItems,
} from './wire'

function unique<T>(list: readonly T[]): T[] {
  return [...new Set(list)]
}

function isSystemUnityName(unity_name: string | null | undefined): boolean {
  return typeof unity_name === 'string' && unity_name.startsWith(__SYSTEM_UNITY_PREFIX__)
}

async function maxOrderIndex(db: DbLike, parent_id: ItemID | null): Promise<number> {
  const rows = await db
    .select({ m: max(items.order_index) })
    .from(items)
    .where(parent_id === null ? isNull(items.parent_id) : eq(items.parent_id, parent_id))
  return rows[0]?.m ?? 0
}

export async function findDatabaseSchema(
  db: DbLike,
  parent_id: ItemID | null,
): Promise<readonly DatabaseFieldDef[] | null> {
  if (parent_id === null) {
    return null
  } else {
    const parent = await getItemRow(db, parent_id)
    if (parent.role !== 'database') {
      return null
    } else {
      return zDatabaseAttributes.parse(parent.attributes).schema
    }
  }
}

export async function findDatabaseValidator(
  db: DbLike,
  parent_id: ItemID | null,
): Promise<ReturnType<typeof itemBuildRowValidator> | null> {
  const schema = await findDatabaseSchema(db, parent_id)
  return schema === null ? null : itemBuildRowValidator(schema)
}

function schemaNeedsUnityName(schema: readonly DatabaseFieldDef[] | null): boolean {
  return schema !== null && schema.some(field => field.type === 'unity_name')
}

async function assertParent(db: DbLike, parent_id: ItemID): Promise<void> {
  const parent = await getItemRow(db, parent_id)
  if (!['page', 'entity', 'database'].includes(parent.role)) {
    throw errorsBadRequest(`role=${parent.role} 不允许有子项`)
  }
}

async function findAncestorIds(
  db: DbLike,
  start_id: ItemID,
  limit: number,
): Promise<ItemID[]> {
  if (limit < 0) {
    throw errorsConflict('父链深度超出限制，数据可能存在环')
  } else {
    const row = await findItemRow(db, start_id)
    if (row === null || row.parent_id === null) {
      return []
    } else {
      return [
        row.parent_id,
        ...await findAncestorIds(db, row.parent_id, limit - 1),
      ]
    }
  }
}

async function validateTagIds(db: DbLike, tag_ids: readonly ItemID[]): Promise<ItemID[]> {
  const ids = unique(tag_ids)
  if (ids.length === 0) {
    return []
  } else {
    const rows = await db
      .select({ id: items.id, role: items.role })
      .from(items)
      .where(inArray(items.id, ids))
    const valid = new Set(rows.filter(row => row.role === 'tag').map(row => row.id))
    const missing = ids.filter(id => !valid.has(id))
    if (missing.length !== 0) {
      throw errorsBadRequest(`tag 不存在或不是 tag: ${missing.join(', ')}`)
    } else {
      return ids
    }
  }
}

async function validateTarget(
  db: DbLike,
  target_id: ItemID,
  self_id: ItemID | null = null,
): Promise<void> {
  if (self_id !== null && target_id === self_id) {
    throw errorsBadRequest('itemlink 不能指向自己')
  } else {
    await getItemRow(db, target_id)
  }
}

async function validateInlineTokens(
  db: DbLike,
  title: string,
  self_id: ItemID | null = null,
): Promise<void> {
  for (const target_id of extractItemTokenIds(title)) {
    await validateTarget(db, target_id, self_id)
  }
}

async function validateBlob(
  blobs_service: BlobService,
  role: Role,
  blob_id: BlobID | undefined,
): Promise<BlobID | null> {
  const needs_blob = role === 'file' || role === 'image'
  if (!needs_blob) {
    if (blob_id !== undefined) {
      throw errorsBadRequest(`role=${role} 不允许 blob_id`)
    } else {
      return null
    }
  } else if (blob_id === undefined) {
    throw errorsBadRequest(`role=${role} 必须提供 blob_id`)
  } else {
    const meta = await blobs_service.getMeta(blob_id)
    if (meta === null) {
      throw errorsNotFound(`blob(${blob_id}) not found`)
    } else if (role === 'image' && (
      !meta.mime.startsWith('image/') || meta.width === null || meta.height === null
    )) {
      throw errorsBadRequest(`blob(${blob_id}) 不是有效图片`)
    } else {
      return meta.id
    }
  }
}

function assertUnityWritable(unity_name: string | undefined, allow_system: boolean): void {
  if (unity_name !== undefined && !allow_system && isSystemUnityName(unity_name)) {
    throw errorsBadRequest(`unity_name 使用了系统保留前缀: ${__SYSTEM_UNITY_PREFIX__}`)
  }
}

function roleKindCheck(role: Role, kind: string | undefined): string | null {
  if (role === 'entity') {
    if (kind === undefined) {
      throw errorsBadRequest('entity 必须提供 kind')
    } else {
      return zKind.parse(kind)
    }
  } else if (kind !== undefined) {
    throw errorsBadRequest('只有 entity 允许 kind')
  } else {
    return null
  }
}

export type CreateItemOptions = {
  allow_system?: boolean
}

export async function createItem(
  db: DbLike,
  form: AddItemForm,
  blobs_service: BlobService,
  options: CreateItemOptions = {},
): Promise<Item> {
  const role = zRole.parse(form.role)
  const kind = roleKindCheck(role, form.kind)
  const unity_name = form.unity_name === undefined ? null : zUnityName.parse(form.unity_name)
  assertUnityWritable(form.unity_name, options.allow_system === true)

  let attributes = as<Record<string, unknown>>(itemCheckAttributes(role, form.attributes ?? {}))

  const parent_id = form.parent_id ?? null
  if (parent_id !== null) {
    await assertParent(db, parent_id)
  }

  const schema = await findDatabaseSchema(db, parent_id)
  if (schema !== null) {
    if (schemaNeedsUnityName(schema) && unity_name === null) {
      throw errorsBadRequest('该 database 的 schema 要求 unity_name')
    }
    attributes = itemBuildRowValidator(schema).parse(attributes)
  }

  const blob_id = await validateBlob(blobs_service, role, form.blob_id)

  if (role === 'itemlink') {
    if (form.target_id === undefined) {throw errorsBadRequest('itemlink 必须提供 target_id')}
  } else if (form.target_id !== undefined) {
    throw errorsBadRequest('只有 itemlink 允许 target_id')
  }
  const target_id = form.target_id ?? null
  if (target_id !== null) {await validateTarget(db, target_id)}

  const tags = await validateTagIds(db, form.tags ?? [])

  const title = form.title ?? ''
  if (isTextBlockRole(role)) {
    await validateInlineTokens(db, title)
  }

  const order_index = (
    form.order_index !== undefined
  ) ? form.order_index : (await maxOrderIndex(db, parent_id) + 1)

  try {
    const new_rows = await db
      .insert(items)
      .values({
        role,
        kind,
        unity_name,
        title,
        attributes,
        tags,
        parent_id,
        order_index,
        blob_id,
        target_id,
      })
      .returning()
    const row = new_rows[0]
    if (row === undefined) {throw new Error('insert returned no row')}
    return await getWireItem(db, row.id)
  } catch (err) {
    const code = errorsPgCode(err)
    if (code === '23505') {throw errorsConflict('unity_name 或 tag 名重复')}
    if (code === '23503') {throw errorsConflict('父项或 blob 引用无效')}
    throw err
  }
}

export async function getItem(db: DbLike, id: ItemID): Promise<Item> {
  return getWireItem(db, id)
}

export async function getItems(db: DbLike, ids: readonly ItemID[]): Promise<Item[]> {
  return getWireItems(db, ids)
}

export async function getItemByUnityName(
  db: DbLike,
  unity_name: string,
): Promise<Item | null> {
  return getWireItemByUnityName(db, unity_name)
}

export async function updateItem(
  db: DbLike,
  id: ItemID,
  data: UpdateItemForm,
  _blobs_service: BlobService,
): Promise<Item> {
  const prev = await getItemRowForUpdate(db, id)
  if (isSystemUnityName(prev.unity_name)) {
    throw errorsBadRequest('系统 item 不能通过通用接口修改')
  }

  const role = prev.role
  let attributes = prev.attributes
  if (data.attributes !== undefined) {
    attributes = as<Record<string, unknown>>(itemCheckAttributes(role, data.attributes))
  }

  const parent_changed = data.parent_id !== undefined
  const new_parent_id = parent_changed ? (data.parent_id ?? null) : prev.parent_id

  if (parent_changed && new_parent_id !== null) {
    await assertParent(db, new_parent_id)
    if (new_parent_id === id) {throw errorsBadRequest('parent 不能指向自己')}
    const ancestors = await findAncestorIds(db, new_parent_id, 1000)
    if (ancestors.includes(id)) {throw errorsConflict('不能移动到自己的后代之下')}
  }

  const schema = await findDatabaseSchema(db, new_parent_id)
  if (schema !== null) {
    if (schemaNeedsUnityName(schema) && prev.unity_name === null) {
      throw errorsBadRequest('该 database 的 schema 要求 unity_name')
    }
    attributes = itemBuildRowValidator(schema).parse(attributes)
  }

  let target_id = prev.target_id
  if (role === 'itemlink') {
    target_id = data.target_id ?? prev.target_id
    if (target_id === null) {throw errorsBadRequest('itemlink 必须提供 target_id')}
    await validateTarget(db, target_id, id)
  } else if (data.target_id !== undefined) {
    throw errorsBadRequest('只有 itemlink 允许 target_id')
  }

  const tags = data.tags !== undefined
    ? await validateTagIds(db, data.tags)
    : prev.tags

  const title = data.title ?? prev.title
  if (isTextBlockRole(role) && (data.title !== undefined || data.attributes !== undefined)) {
    await validateInlineTokens(db, title, id)
  }

  try {
    const updated = await db
      .update(items)
      .set({
        title,
        attributes,
        tags,
        parent_id: new_parent_id,
        order_index: data.order_index ?? prev.order_index,
        target_id,
        update_date: new Date(),
      })
      .where(eq(items.id, id))
      .returning()
    const row = updated[0]
    if (row === undefined) {throw errorsNotFound(`item(id=${id}) not found`)}
    return await getWireItem(db, row.id)
  } catch (err) {
    const code = errorsPgCode(err)
    if (code === '23503') {throw errorsConflict('父项或引用无效')}
    throw err
  }
}

export async function convertTextBlock(
  db: DbLike,
  id: ItemID,
  role: TextBlockRole,
  title: string | undefined,
  attributes: Readonly<Record<string, unknown>> | undefined,
): Promise<Item> {
  const prev = await getItemRowForUpdate(db, id)
  if (!isTextBlockRole(prev.role)) {
    throw errorsBadRequest(`item(id=${id}) 不是文本块，不能转换 role`)
  } else if (!isTextBlockRole(role)) {
    throw errorsBadRequest(`role=${role} 不是文本块`)
  } else {
    const next_title = title ?? prev.title
    if (title !== undefined) {
      await validateInlineTokens(db, next_title, id)
    }
    const next_attributes = attributes === undefined
      ? prev.attributes
      : as<Record<string, unknown>>(itemCheckAttributes(role, attributes))
    const updated = await db
      .update(items)
      .set({ role, title: next_title, attributes: next_attributes, update_date: new Date() })
      .where(eq(items.id, id))
      .returning()
    const row = updated[0]
    if (row === undefined) {throw errorsNotFound(`item(id=${id}) not found`)}
    return await getWireItem(db, row.id)
  }
}

export async function deleteItem(db: DbLike, id: ItemID): Promise<void> {
  const found = await getItemRowForUpdate(db, id)
  if (isSystemUnityName(found.unity_name)) {
    throw errorsBadRequest('系统 item 不能通过通用接口删除')
  }

  const child_rows = await db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.parent_id, id))
    .limit(1)
  if (child_rows.length !== 0) {
    throw errorsConflict(`item(id=${id}) 存在子项，不能删除`)
  }

  if (found.role === 'tag') {
    await db
      .update(items)
      .set({ tags: sql`array_remove(${items.tags}, ${id})` })
      .where(sql`${id} = ANY(${items.tags})`)
  }

  await db.delete(items).where(eq(items.id, id))
}
