import {
  bigint,
  bigserial,
  doublePrecision,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const items = pgTable('items', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  role: text('role').notNull().default('custom'),
  title: text('title').notNull().default(''),
  attributes: jsonb('attributes').$type<Record<string, unknown>>().notNull().default({}),
  tags: bigint('tags', { mode: 'number' }).array().notNull().default(sql`'{}'`),
  parent_id: bigint('parent_id', { mode: 'number' }).references((): any => items.id),
  order_index: doublePrecision('order_index').notNull().default(0),
  create_date: timestamp('create_date', { withTimezone: true }).notNull().defaultNow(),
  update_date: timestamp('update_date', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('items_parent_idx').on(table.parent_id, table.order_index),
  index('items_role_idx').on(table.role),
  index('items_tags_gin_idx').using('gin', table.tags),
  index('items_create_date_idx').on(table.create_date),
  index('items_update_date_idx').on(table.update_date),
  uniqueIndex('items_tag_title_unique_idx')
    .on(sql`lower(${table.title})`)
    .where(sql`${table.role} = 'tag'`),
])

export type ItemRow = typeof items.$inferSelect
