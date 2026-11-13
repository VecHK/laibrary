import {
  and, asc, desc, eq, inArray, isNull, or, sql, type SQL,
} from 'drizzle-orm'
import { z } from 'zod'
import { match } from 'ts-pattern'
import type {
  FilterGroup, FilterRule, Item, ItemID, ListingParams,
} from '@laibrary/types'
import type { DbLike } from '../db/client'
import { blobs, items } from '../db/schema'
import { getItemRow } from './wire'
import { toWireItem } from './wire'

function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, '\\$&')
}

function ruleToCondition(rule: FilterRule): SQL {
  const cond =
    match(rule)
    .with({ name: 'role' }, value => (
      Array.isArray(value.input)
      ? inArray(items.role, value.input)
      : eq(items.role, value.input)
    ))
    .with({ name: 'kind' }, value => eq(items.kind, value.input))
    .with({ name: 'unity_name' }, value => eq(items.unity_name, value.input))
    .with({ name: 'title' }, value => sql`${items.title} ILIKE ${`%${escapeLike(value.input)}%`}`)
    .with({ name: 'has_tag' }, value => sql`${items.tags} @> ARRAY[${value.input}]::bigint[]`)
    .with({ name: 'empty_tag' }, () => sql`coalesce(array_length(${items.tags}, 1), 0) = 0`)
    .with({ name: 'parent' }, value => (
      value.input === null ? isNull(items.parent_id) : eq(items.parent_id, value.input)
    ))
    .with({ name: 'attribute_equal' }, value => sql`${items.attributes}->${value.input.name} = ${JSON.stringify(value.input.value)}::jsonb`)
    .exhaustive()
  return rule.invert === true ? sql`NOT (${cond})` : cond
}

function groupToCondition(group: FilterGroup): SQL | undefined {
  const conds = group.rules.map(ruleToCondition)
  if (conds.length === 0) {
    return undefined
  } else {
    const combined = group.logic === 'and' ? and(...conds) : or(...conds)
    if (combined === undefined) {
      return undefined
    } else {
      return group.invert ? sql`NOT (${combined})` : combined
    }
  }
}

export function itemBuildFilterCondition(
  filter_rules: readonly FilterRule[],
  filter_groups: readonly FilterGroup[],
): SQL | undefined {
  const combined_groups: FilterGroup[] =
                  filter_rules.length !== 0
                  ? [{ logic: 'and', invert: false, rules: [...filter_rules] }]
                  : []
  const groups: readonly FilterGroup[] = [...filter_groups, ...combined_groups]

  let $and_conds: SQL[] = []
  let $or_conds: SQL[] = []
  for (const group of groups) {
    const cond = groupToCondition(group)
    if (cond !== undefined) {
      if (group.logic === 'and') {
        $and_conds = [...$and_conds, cond]
      } else {
        $or_conds = [...$or_conds, cond]
      }
    }
  }

  let $final_conds: SQL[] = [...$and_conds]
  if ($or_conds.length !== 0) {
    const combined = or(...$or_conds)
    if (combined !== undefined) {
      $final_conds = [...$final_conds, combined]
    }
  }

  if ($final_conds.length === 0) {
    return undefined
  } else if ($final_conds.length === 1) {
    return $final_conds[0]
  } else {
    return and(...$final_conds)
  }
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
  const rows = z.array(z.object({ value: z.unknown() })).parse(result.rows)
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

  const filter_cond = itemBuildFilterCondition(
    params.filter_rules ?? [],
    params.filter_groups ?? [],
  )
  const system_cond = options.include_system !== true
                      ? sql`(${items.unity_name} IS NULL OR ${items.unity_name} NOT LIKE 'sys.%')`
                      : undefined

  let $order_clause: SQL
  let $after_cond: SQL | undefined = undefined
  if (sort_field !== undefined) {
    const expression = sortFieldExpression(sort_field)
    $order_clause = sql`${expression} ${sql.raw(desc_order ? 'DESC' : 'ASC')} NULLS LAST`

    if (params.after_id !== undefined) {
      await getItemRow(db, params.after_id)
      const after_value = await readSortFieldValue(db, expression, params.after_id)
      const cmp = desc_order ? '<' : '>'
      if (after_value === null || after_value === undefined) {
        $after_cond = sql`${expression} IS NULL AND ${items.id} ${sql.raw(cmp)} ${params.after_id}`
      } else {
        $after_cond = sql`
          (${expression} IS NOT NULL AND (${expression}, ${items.id}) ${sql.raw(cmp)} (${after_value}, ${params.after_id}))
          OR ${expression} IS NULL
        `
      }
    }
  } else {
    const sort_col = SORT_COLUMNS[sort_by]
    $order_clause = desc_order ? desc(sort_col) : asc(sort_col)

    if (params.after_id !== undefined) {
      const after_row = await getItemRow(db, params.after_id)
      const after_sort_value = after_row[sort_by]
      const cmp = desc_order ? '<' : '>'
      $after_cond = sql`(${sort_col}, ${items.id}) ${sql.raw(cmp)} (${after_sort_value}, ${params.after_id})`
    }
  }

  const where_conds: (SQL | undefined)[] = [filter_cond, system_cond, $after_cond]
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

  query.orderBy($order_clause, desc_order ? desc(items.id) : asc(items.id))
  if (limit !== 0) {
    query.limit(limit)
  }

  const rows = await query
  return rows.map(row => toWireItem(row.item, row.blob))
}
