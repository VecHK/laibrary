import {
  and, asc, desc, eq, ilike, inArray, isNull, max, not, or,
  sql, type SQL,
} from 'drizzle-orm'
import type { PgColumn } from 'drizzle-orm/pg-core'
import {
  AddItemForm, FilterGroup, FilterRule, Item,
  ItemID, ListingParams, Role, UpdateItemForm,
  buildRowValidator, checkAttributes, zDatabaseAttributes,
} from '@laibrary/types'
import type { DB } from '../db/client'
import { items, type ItemRow } from '../db/schema'
import { findItemRow, getItemRow, toWireItem } from './wire'
import type { FilePool } from '../blob/file-pool'
import { checkFileRefsExist } from '../blob/gc'

function unique(list: number[]): number[] {
  return [...new Set(list)]
}

async function maxOrderIndex(db: DB, parent_id: ItemID | null): Promise<number> {
  const rows = await db
    .select({ m: max(items.order_index) })
    .from(items)
    .where(parent_id === null ? isNull(items.parent_id) : eq(items.parent_id, parent_id))
  return rows[0]?.m ?? 0
}

export async function findDatabaseValidator(
  db: DB,
  parent_id: ItemID | null,
): Promise<ReturnType<typeof buildRowValidator> | null> {
  if (parent_id === null) {
    return null
  }
  const parent = await getItemRow(db, parent_id)
  if (parent.role === 'database') {
    const attrs = zDatabaseAttributes.parse(parent.attributes)
    return buildRowValidator(attrs.schema)
  } else {
    return null
  }
}

async function findAncestorIds(db: DB, start_id: ItemID, limit = 1000): Promise<ItemID[]> {
  const ancestors: ItemID[] = []
  let current: ItemID | null = start_id
  let count = 0
  while (current !== null) {
    const row = await findItemRow(db, current)
    if (row === null) {
      break
    }
    if (row.parent_id !== null) {
      ancestors.push(row.parent_id)
    }
    current = row.parent_id
    count += 1
    if (count > limit) {
      throw new Error('父链深度超出限制,数据可能存在环')
    }
  }
  return ancestors
}

export async function createItem(db: DB, form: AddItemForm, file_pool: FilePool): Promise<Item> {
  const role = form.role
  let attributes: Record<string, unknown> = (
    checkAttributes(role, form.attributes ?? {}) as unknown as Record<string, unknown>
  )

  const parent_id = form.parent_id ?? null
  if (parent_id !== null) {
    await getItemRow(db, parent_id)
  }

  const row_validator = await findDatabaseValidator(db, parent_id)
  if (row_validator !== null) {
    attributes = row_validator.parse(attributes)
  }

  await checkFileRefsExist(file_pool, attributes)

  const order_index = (
    form.order_index !== undefined
  ) ? form.order_index : (await maxOrderIndex(db, parent_id) + 1)

  const new_rows = await db
    .insert(items)
    .values({
      role,
      title: form.title ?? '',
      attributes,
      tags: unique(form.tags ?? []),
      parent_id,
      order_index,
    })
    .returning()

  return toWireItem(new_rows[0] as ItemRow)
}

export async function getItem(db: DB, id: ItemID): Promise<Item> {
  return toWireItem(await getItemRow(db, id))
}

export async function getItems(db: DB, ids: ItemID[]): Promise<Item[]> {
  if (ids.length === 0) {
    return []
  }
  const rows = await db.select().from(items).where(inArray(items.id, ids))
  const map = new Map(rows.map(row => [row.id, row]))
  return ids.map(id => {
    const row = map.get(id)
    if (row === undefined) {
      throw new Error(`item(id=${id}) not found`)
    } else {
      return toWireItem(row)
    }
  })
}

export async function updateItem(
  db: DB,
  id: ItemID,
  data: UpdateItemForm,
  file_pool: FilePool,
): Promise<Item> {
  const prev = await getItemRow(db, id)

  const new_role = data.role ?? (prev.role as Role)

  let new_attributes: Record<string, unknown> = prev.attributes
  if (data.attributes !== undefined) {
    new_attributes = checkAttributes(new_role, data.attributes) as unknown as Record<string, unknown>
  }

  const parent_changed = data.parent_id !== undefined
  const new_parent_id = parent_changed ? (data.parent_id ?? null) : prev.parent_id

  if (parent_changed && new_parent_id !== null) {
    await getItemRow(db, new_parent_id)
    if (new_parent_id === id) {
      throw new Error('parent 不能指向自己')
    }
    const ancestors = await findAncestorIds(db, new_parent_id)
    if (ancestors.includes(id)) {
      throw new Error('不能移动到自己的后代之下')
    }
  }

  const row_validator = await findDatabaseValidator(db, new_parent_id)
  if (row_validator !== null) {
    new_attributes = row_validator.parse(new_attributes)
  }

  await checkFileRefsExist(file_pool, new_attributes)

  const new_rows = await db
    .update(items)
    .set({
      role: new_role,
      title: data.title ?? prev.title,
      attributes: new_attributes,
      tags: data.tags !== undefined ? unique(data.tags) : prev.tags,
      parent_id: new_parent_id,
      order_index: data.order_index ?? prev.order_index,
      update_date: new Date(),
    })
    .where(eq(items.id, id))
    .returning()

  return toWireItem(new_rows[0] as ItemRow)
}

export async function deleteItem(db: DB, id: ItemID): Promise<void> {
  const found = await getItemRow(db, id)

  const child_rows = await db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.parent_id, id))
    .limit(1)
  if (child_rows.length !== 0) {
    throw new Error(`item(id=${id}) 存在子项,不能删除`)
  }

  if (found.role === 'tag') {
    await db
      .update(items)
      .set({ tags: sql`array_remove(${items.tags}, ${id})` })
      .where(sql`${id} = ANY(${items.tags})`)
  }

  await db.delete(items).where(eq(items.id, id))
}

function ruleToCondition(rule: FilterRule): SQL | undefined {
  let cond: SQL | undefined
  if (rule.name === 'role') {
    cond = (
      Array.isArray(rule.input)
    ) ? inArray(items.role, rule.input) : eq(items.role, rule.input)
  } else if (rule.name === 'title') {
    cond = ilike(items.title, `%${rule.input}%`)
  } else if (rule.name === 'has_tag') {
    cond = sql`${items.tags} @> ARRAY[${rule.input}]::bigint[]`
  } else if (rule.name === 'empty_tag') {
    cond = sql`coalesce(array_length(${items.tags}, 1), 0) = 0`
  } else if (rule.name === 'parent') {
    cond = (rule.input === null)
      ? isNull(items.parent_id)
      : eq(items.parent_id, rule.input)
  } else if (rule.name === 'attribute_equal') {
    cond = sql`${items.attributes}->${rule.input.name} = ${JSON.stringify(rule.input.value)}::jsonb`
  } else {
    return undefined
  }
  return rule.invert ? not(cond) : cond
}

function groupToCondition(group: FilterGroup): SQL | undefined {
  const conds = group.rules
    .map(ruleToCondition)
    .filter((c): c is SQL => c !== undefined)

  if (conds.length === 0) {
    return undefined
  }

  const combined = (
    group.logic === 'and'
  ) ? and(...conds) : or(...conds)

  if (combined === undefined) {
    return undefined
  }

  return group.invert ? not(combined) : combined
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
    if (cond === undefined) {
      continue
    }
    if (group.logic === 'and') {
      and_conds.push(cond)
    } else {
      or_conds.push(cond)
    }
  }

  const final_conds: SQL[] = [...and_conds]
  if (or_conds.length !== 0) {
    if (or_conds.length === 1) {
      final_conds.push(or_conds[0]!)
    } else {
      const or_combined = or(...or_conds)
      if (or_combined !== undefined) {
        final_conds.push(or_combined)
      }
    }
  }

  if (final_conds.length === 0) {
    return undefined
  } else if (final_conds.length === 1) {
    return final_conds[0]!
  } else {
    return and(...final_conds)
  }
}

const SORT_COLUMNS = {
  id: items.id,
  create_date: items.create_date,
  update_date: items.update_date,
  order_index: items.order_index,
} as const

export async function listItems(db: DB, params: ListingParams): Promise<Item[]> {
  const sort_by = params.sort_by ?? 'id'
  const desc_order = Boolean(params.desc)
  const sort_field = params.sort_field

  const filter_cond = buildFilterCondition(params.filter_rules, params.filter_groups)

  const where_conds: (SQL | undefined)[] = [filter_cond]

  let sort_expr: SQL | PgColumn
  let order_clause: SQL

  if (sort_field !== undefined) {
    const field_base = (
      sort_field.type === 'number'
    ) ? sql`(${items.attributes}->>${sort_field.name})::numeric`
      : sql`${items.attributes}->>${sort_field.name}`

    sort_expr = field_base
    order_clause = sql`${field_base} ${sql.raw(desc_order ? 'DESC' : 'ASC')} NULLS LAST`

    if (params.after_id !== undefined) {
      const after_row = await getItemRow(db, params.after_id)
      const after_val = after_row.attributes[sort_field.name]
      if (
        !(sort_field.type === 'number' ? (typeof after_val === 'number') : (typeof after_val === 'string'))
      ) {
        return []
      }
      const cmp = desc_order ? '<' : '>'
      where_conds.push(
        sql`(${sort_expr}, ${items.id}) ${sql.raw(cmp)} (${after_val}, ${params.after_id})`,
      )
    }
  } else {
    const sort_col = SORT_COLUMNS[sort_by]
    sort_expr = sort_col
    order_clause = desc_order ? desc(sort_col) : asc(sort_col)

    if (params.after_id !== undefined) {
      const after_row = await getItemRow(db, params.after_id)
      const after_sort_value = after_row[sort_by]
      const cmp = desc_order ? '<' : '>'
      where_conds.push(
        sql`(${sort_expr}, ${items.id}) ${sql.raw(cmp)} (${after_sort_value}, ${params.after_id})`,
      )
    }
  }

  const conds = where_conds.filter((c): c is SQL => c !== undefined)

  const query = db
    .select()
    .from(items)

  if (conds.length !== 0) {
    if (conds.length === 1) {
      query.where(conds[0]!)
    } else {
      query.where(and(...conds))
    }
  }

  query.orderBy(order_clause, desc_order ? desc(items.id) : asc(items.id))

  if (params.limit !== 0) {
    query.limit(params.limit)
  }

  const rows = await query
  return rows.map(toWireItem)
}
