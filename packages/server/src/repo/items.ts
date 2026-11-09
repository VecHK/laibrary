import {
  and, asc, desc, eq, inArray, isNull, max, or, sql, type SQL,
} from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import type {
  AddItemForm, BlobID, DatabaseFieldDef, FilterGroup, FilterRule,
  Item, ItemID, ListingParams, Role, UpdateItemForm,
} from '@laibrary/types'
import {
  SYSTEM_UNITY_PREFIX, buildRowValidator, checkAttributes, extractItemTokenIds,
  zDatabaseAttributes, zKind, zRole, zUnityName,
} from '@laibrary/types'
import type { DbLike } from '../db/client'
import { blobs, items } from '../db/schema'
import { badRequest, conflict, notFound, pgErrorCode } from '../errors'
import type { BlobService } from '../blob/service'
import {
  findItemRow, getItemRow, getItemRowForUpdate, getWireItem,
  getWireItemByUnityName, getWireItems, toWireItem,
} from './wire'

function unique<T>(list: T[]): T[] {
  return [...new Set(list)]
}

function isSystemUnityName(unity_name: string | null | undefined): boolean {
  return typeof unity_name === 'string' && unity_name.startsWith(SYSTEM_UNITY_PREFIX)
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
): Promise<DatabaseFieldDef[] | null> {
  if (parent_id === null) {return null}
  const parent = await getItemRow(db, parent_id)
  if (parent.role !== 'database') {return null}
  const attrs = zDatabaseAttributes.parse(parent.attributes)
  return attrs.schema
}

export async function findDatabaseValidator(
  db: DbLike,
  parent_id: ItemID | null,
): Promise<ReturnType<typeof buildRowValidator> | null> {
  const schema = await findDatabaseSchema(db, parent_id)
  return schema === null ? null : buildRowValidator(schema)
}

function schemaNeedsUnityName(schema: DatabaseFieldDef[] | null): boolean {
  return schema !== null && schema.some(field => field.type === 'unity_name')
}

async function assertParent(db: DbLike, parent_id: ItemID): Promise<void> {
  const parent = await getItemRow(db, parent_id)
  if (!['page', 'entity', 'database'].includes(parent.role)) {
    throw badRequest(`role=${parent.role} 不允许有子项`)
  }
}

async function findAncestorIds(
  db: DbLike,
  start_id: ItemID,
  limit: number = 1000,
): Promise<ItemID[]> {
  const ancestors: ItemID[] = []
  let current: ItemID | null = start_id
  let count = 0
  while (current !== null) {
    const row = await findItemRow(db, current)
    if (row === null) {break}
    if (row.parent_id !== null) {ancestors.push(row.parent_id)}
    current = row.parent_id
    count += 1
    if (count > limit) {
      throw conflict('父链深度超出限制，数据可能存在环')
    }
  }
  return ancestors
}

async function validateTagIds(db: DbLike, tag_ids: ItemID[]): Promise<ItemID[]> {
  const ids = unique(tag_ids)
  if (ids.length === 0) {return []}
  const rows = await db
    .select({ id: items.id, role: items.role })
    .from(items)
    .where(inArray(items.id, ids))
  const valid = new Set(rows.filter(row => row.role === 'tag').map(row => row.id))
  const missing = ids.filter(id => !valid.has(id))
  if (missing.length !== 0) {
    throw badRequest(`tag 不存在或不是 tag: ${missing.join(', ')}`)
  }
  return ids
}

async function validateTarget(
  db: DbLike,
  target_id: ItemID,
  self_id: ItemID | null = null,
): Promise<void> {
  if (self_id !== null && target_id === self_id) {
    throw badRequest('itemlink 不能指向自己')
  }
  await getItemRow(db, target_id)
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
    if (blob_id !== undefined) {throw badRequest(`role=${role} 不允许 blob_id`)}
    return null
  }
  if (blob_id === undefined) {throw badRequest(`role=${role} 必须提供 blob_id`)}
  const meta = await blobs_service.getMeta(blob_id)
  if (meta === null) {throw notFound(`blob(${blob_id}) not found`)}
  if (role === 'image') {
    if (!meta.mime.startsWith('image/') || meta.width === null || meta.height === null) {
      throw badRequest(`blob(${blob_id}) 不是有效图片`)
    }
  }
  return meta.id
}

function assertUnityWritable(unity_name: string | undefined, allow_system: boolean): void {
  if (unity_name === undefined) {return}
  if (!allow_system && isSystemUnityName(unity_name)) {
    throw badRequest(`unity_name 使用了系统保留前缀: ${SYSTEM_UNITY_PREFIX}`)
  }
}

function roleKindCheck(role: Role, kind: string | undefined): string | null {
  if (role === 'entity') {
    if (kind === undefined) {throw badRequest('entity 必须提供 kind')}
    return zKind.parse(kind)
  }
  if (kind !== undefined) {throw badRequest('只有 entity 允许 kind')}
  return null
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
  const role = zRole.parse(form.role) as Role
  const kind = roleKindCheck(role, form.kind)
  const unity_name = form.unity_name === undefined ? null : zUnityName.parse(form.unity_name)
  assertUnityWritable(form.unity_name, options.allow_system === true)

  let attributes = checkAttributes(role, form.attributes ?? {}) as unknown as Record<string, unknown>

  const parent_id = form.parent_id ?? null
  if (parent_id !== null) {
    await assertParent(db, parent_id)
  }

  const schema = await findDatabaseSchema(db, parent_id)
  if (schema !== null) {
    if (schemaNeedsUnityName(schema) && unity_name === null) {
      throw badRequest('该 database 的 schema 要求 unity_name')
    }
    attributes = buildRowValidator(schema).parse(attributes) as Record<string, unknown>
  }

  const blob_id = await validateBlob(blobs_service, role, form.blob_id)

  if (role === 'itemlink') {
    if (form.target_id === undefined) {throw badRequest('itemlink 必须提供 target_id')}
  } else if (form.target_id !== undefined) {
    throw badRequest('只有 itemlink 允许 target_id')
  }
  const target_id = form.target_id ?? null
  if (target_id !== null) {await validateTarget(db, target_id)}

  const tags = await validateTagIds(db, form.tags ?? [])

  const title = form.title ?? ''
  if (role === 'textline') {
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
    const code = pgErrorCode(err)
    if (code === '23505') {throw conflict('unity_name 或 tag 名重复')}
    if (code === '23503') {throw conflict('父项或 blob 引用无效')}
    throw err
  }
}

export async function getItem(db: DbLike, id: ItemID): Promise<Item> {
  return getWireItem(db, id)
}

export async function getItems(db: DbLike, ids: ItemID[]): Promise<Item[]> {
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
    throw badRequest('系统 item 不能通过通用接口修改')
  }

  const role = prev.role as Role
  let attributes = prev.attributes
  if (data.attributes !== undefined) {
    attributes = checkAttributes(role, data.attributes) as unknown as Record<string, unknown>
  }

  const parent_changed = data.parent_id !== undefined
  const new_parent_id = parent_changed ? (data.parent_id ?? null) : prev.parent_id

  if (parent_changed && new_parent_id !== null) {
    await assertParent(db, new_parent_id)
    if (new_parent_id === id) {throw badRequest('parent 不能指向自己')}
    const ancestors = await findAncestorIds(db, new_parent_id)
    if (ancestors.includes(id)) {throw conflict('不能移动到自己的后代之下')}
  }

  const schema = await findDatabaseSchema(db, new_parent_id)
  if (schema !== null) {
    if (schemaNeedsUnityName(schema) && prev.unity_name === null) {
      throw badRequest('该 database 的 schema 要求 unity_name')
    }
    attributes = buildRowValidator(schema).parse(attributes) as Record<string, unknown>
  }

  let target_id = prev.target_id
  if (role === 'itemlink') {
    target_id = data.target_id ?? prev.target_id
    if (target_id === null) {throw badRequest('itemlink 必须提供 target_id')}
    await validateTarget(db, target_id, id)
  } else if (data.target_id !== undefined) {
    throw badRequest('只有 itemlink 允许 target_id')
  }

  const tags = data.tags !== undefined
    ? await validateTagIds(db, data.tags)
    : prev.tags

  const title = data.title ?? prev.title
  if (role === 'textline' && (data.title !== undefined || data.attributes !== undefined)) {
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
    if (row === undefined) {throw notFound(`item(id=${id}) not found`)}
    return await getWireItem(db, row.id)
  } catch (err) {
    const code = pgErrorCode(err)
    if (code === '23503') {throw conflict('父项或引用无效')}
    throw err
  }
}

export async function deleteItem(db: DbLike, id: ItemID): Promise<void> {
  const found = await getItemRowForUpdate(db, id)
  if (isSystemUnityName(found.unity_name)) {
    throw badRequest('系统 item 不能通过通用接口删除')
  }

  const child_rows = await db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.parent_id, id))
    .limit(1)
  if (child_rows.length !== 0) {
    throw conflict(`item(id=${id}) 存在子项，不能删除`)
  }

  if (found.role === 'tag') {
    await db
      .update(items)
      .set({ tags: sql`array_remove(${items.tags}, ${id})` })
      .where(sql`${id} = ANY(${items.tags})`)
  }

  await db.delete(items).where(eq(items.id, id))
}

function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&')
}

function ruleToCondition(rule: FilterRule): SQL | undefined {
  let cond: SQL | undefined
  if (rule.name === 'role') {
    cond = Array.isArray(rule.input)
      ? inArray(items.role, rule.input)
      : eq(items.role, rule.input)
  } else if (rule.name === 'kind') {
    cond = eq(items.kind, rule.input)
  } else if (rule.name === 'unity_name') {
    cond = eq(items.unity_name, rule.input)
  } else if (rule.name === 'title') {
    cond = sql`${items.title} ILIKE ${`%${escapeLike(rule.input)}%`}`
  } else if (rule.name === 'has_tag') {
    cond = sql`${items.tags} @> ARRAY[${rule.input}]::bigint[]`
  } else if (rule.name === 'empty_tag') {
    cond = sql`coalesce(array_length(${items.tags}, 1), 0) = 0`
  } else if (rule.name === 'parent') {
    cond = rule.input === null ? isNull(items.parent_id) : eq(items.parent_id, rule.input)
  } else if (rule.name === 'attribute_equal') {
    cond = sql`${items.attributes}->${rule.input.name} = ${JSON.stringify(rule.input.value)}::jsonb`
  } else {
    return undefined
  }
  return rule.invert ? sql`NOT (${cond})` : cond
}

function groupToCondition(group: FilterGroup): SQL | undefined {
  const conds = group.rules
    .map(ruleToCondition)
    .filter((cond): cond is SQL => cond !== undefined)
  if (conds.length === 0) {return undefined}
  const combined = group.logic === 'and' ? and(...conds) : or(...conds)
  if (combined === undefined) {return undefined}
  return group.invert ? sql`NOT (${combined})` : combined
}

export function buildFilterCondition(
  filter_rules: FilterRule[] = [],
  filter_groups: FilterGroup[] = [],
): SQL | undefined {
  const groups: FilterGroup[] = [...filter_groups]
  if (filter_rules.length !== 0) {
    groups.push({ logic: 'and', invert: false, rules: filter_rules })
  }

  const and_conds: SQL[] = []
  const or_conds: SQL[] = []
  for (const group of groups) {
    const cond = groupToCondition(group)
    if (cond !== undefined) {
      if (group.logic === 'and') {and_conds.push(cond)}
      else {or_conds.push(cond)}
    }
  }

  const final_conds: SQL[] = [...and_conds]
  if (or_conds.length !== 0) {
    const combined = or(...or_conds)
    if (combined !== undefined) {final_conds.push(combined)}
  }

  if (final_conds.length === 0) {return undefined}
  if (final_conds.length === 1) {return final_conds[0]}
  return and(...final_conds)
}

const SORT_COLUMNS = {
  id: items.id,
  create_date: items.create_date,
  update_date: items.update_date,
  order_index: items.order_index,
} as const

function sortFieldExpression(sort_field: { name: string, type: 'string' | 'number' }): SQL {
  if (sort_field.type === 'number') {
    return sql`CASE WHEN jsonb_typeof(${items.attributes} -> ${sort_field.name}) = 'number'
      THEN (${items.attributes} ->> ${sort_field.name})::numeric END`
  }
  return sql`${items.attributes} ->> ${sort_field.name}`
}

async function readSortFieldValue(
  db: DbLike,
  expression: SQL,
  after_id: ItemID,
): Promise<unknown> {
  const result = await db.execute(sql`
    SELECT ${expression} AS value
    FROM ${items}
    WHERE ${items.id} = ${after_id}
    LIMIT 1
  `)
  const rows = (result as unknown as { rows: Array<{ value: unknown }> }).rows
  return rows[0]?.value ?? null
}

export async function listItems(
  db: DbLike,
  params: ListingParams,
  options: { include_system?: boolean } = {},
): Promise<Item[]> {
  const sort_by = params.sort_by ?? 'id'
  const desc_order = Boolean(params.desc)
  const sort_field = params.sort_field
  const limit = params.limit === 0 ? 0 : Math.min(params.limit, 10_000)

  const filter_cond = buildFilterCondition(params.filter_rules, params.filter_groups)
  const where_conds: (SQL | undefined)[] = [filter_cond]

  if (options.include_system !== true) {
    where_conds.push(sql`(${items.unity_name} IS NULL OR ${items.unity_name} NOT LIKE 'sys.%')`)
  }

  let order_clause: SQL
  if (sort_field !== undefined) {
    const expression = sortFieldExpression(sort_field)
    order_clause = sql`${expression} ${sql.raw(desc_order ? 'DESC' : 'ASC')} NULLS LAST`

    if (params.after_id !== undefined) {
      await getItemRow(db, params.after_id)
      const after_value = await readSortFieldValue(db, expression, params.after_id)
      const cmp = desc_order ? '<' : '>'
      if (after_value === null || after_value === undefined) {
        where_conds.push(
          sql`${expression} IS NULL AND ${items.id} ${sql.raw(cmp)} ${params.after_id}`,
        )
      } else {
        where_conds.push(sql`
          (${expression} IS NOT NULL AND (${expression}, ${items.id}) ${sql.raw(cmp)} (${after_value}, ${params.after_id}))
          OR ${expression} IS NULL
        `)
      }
    }
  } else {
    const sort_col = SORT_COLUMNS[sort_by] as PgColumn
    order_clause = desc_order ? desc(sort_col) : asc(sort_col)

    if (params.after_id !== undefined) {
      const after_row = await getItemRow(db, params.after_id)
      const after_sort_value = after_row[sort_by]
      const cmp = desc_order ? '<' : '>'
      where_conds.push(
        sql`(${sort_col}, ${items.id}) ${sql.raw(cmp)} (${after_sort_value}, ${params.after_id})`,
      )
    }
  }

  const conds = where_conds.filter((cond): cond is SQL => cond !== undefined)
  const query = db
    .select({ item: items, blob: blobs })
    .from(items)
    .leftJoin(blobs, eq(items.blob_id, blobs.id))

  if (conds.length === 1) {
    const first_cond = conds[0]
    if (first_cond !== undefined) {query.where(first_cond)}
  } else if (conds.length > 1) {
    query.where(and(...conds))
  }

  query.orderBy(order_clause, desc_order ? desc(items.id) : asc(items.id))
  if (limit !== 0) {query.limit(limit)}

  const rows = await query
  return rows.map(row => toWireItem(row.item, row.blob))
}
