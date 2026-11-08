import {
  bigint,
  bigserial,
  check,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const blobs = pgTable('blobs', {
  id: text('id').primaryKey(),
  size: bigint('size', { mode: 'number' }).notNull(),
  mime: text('mime').notNull(),
  width: integer('width'),
  height: integer('height'),
  create_date: timestamp('create_date', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('blobs_create_date_idx').on(table.create_date),
])

export const items = pgTable('items', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  role: text('role').notNull().default('page'),
  kind: text('kind'),
  unity_name: text('unity_name'),
  title: text('title').notNull().default(''),
  attributes: jsonb('attributes').$type<Record<string, unknown>>().notNull().default({}),
  tags: bigint('tags', { mode: 'number' }).array().notNull().default(sql`'{}'`),
  parent_id: bigint('parent_id', { mode: 'number' }).references((): any => items.id),
  order_index: doublePrecision('order_index').notNull().default(0),
  blob_id: text('blob_id').references(() => blobs.id),
  target_id: bigint('target_id', { mode: 'number' }),
  create_date: timestamp('create_date', { withTimezone: true }).notNull().defaultNow(),
  update_date: timestamp('update_date', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index('items_parent_idx').on(table.parent_id, table.order_index, table.id),
  index('items_role_idx').on(table.role),
  index('items_kind_idx').on(table.kind),
  index('items_tags_gin_idx').using('gin', table.tags),
  index('items_create_date_idx').on(table.create_date),
  index('items_update_date_idx').on(table.update_date),
  index('items_blob_id_idx').on(table.blob_id),
  index('items_target_id_idx').on(table.target_id),
  uniqueIndex('items_tag_title_unique_idx')
    .on(sql`lower(${table.title})`)
    .where(sql`${table.role} = 'tag'`),
  uniqueIndex('items_unity_name_unique_idx')
    .on(table.unity_name)
    .where(sql`${table.unity_name} IS NOT NULL`),
  check('items_role_check', sql`
    ${table.role} IN ('page', 'entity', 'textline', 'image', 'file', 'itemlink', 'tag', 'database')
  `),
  check('items_entity_kind_check', sql`
    (${table.role} = 'entity') = (${table.kind} IS NOT NULL)
  `),
  check('items_itemlink_target_check', sql`
    (${table.role} = 'itemlink') = (${table.target_id} IS NOT NULL)
  `),
  check('items_blob_role_check', sql`
    (${table.role} IN ('file', 'image')) = (${table.blob_id} IS NOT NULL)
  `),
  check('items_attributes_object_check', sql`
    jsonb_typeof(${table.attributes}) = 'object'
  `),
  check('items_tags_no_null_check', sql`
    array_position(${table.tags}, NULL) IS NULL
  `),
  check('items_order_index_finite_check', sql`
    abs(${table.order_index}) < 'Infinity'::double precision
  `),
  check('items_kind_format_check', sql`
    ${table.kind} IS NULL OR ${table.kind} ~ '^[a-z][a-z0-9._-]{0,63}$'
  `),
  check('items_unity_name_format_check', sql`
    ${table.unity_name} IS NULL OR ${table.unity_name} ~ '^[a-z][a-z0-9._-]{0,199}$'
  `),
])

export const thumbnails = pgTable('thumbnails', {
  image_id: bigint('image_id', { mode: 'number' })
    .notNull()
    .references(() => items.id, { onDelete: 'cascade' }),
  size: smallint('size').notNull(),
  blob_id: text('blob_id').notNull().references(() => blobs.id),
  width: integer('width').notNull(),
  height: integer('height').notNull(),
  create_date: timestamp('create_date', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  primaryKey({ columns: [table.image_id, table.size] }),
  index('thumbnails_blob_id_idx').on(table.blob_id),
  check('thumbnails_size_check', sql`
    ${table.size} IN (96, 384, 800, 1440)
  `),
])

export type ItemRow = typeof items.$inferSelect
export type BlobRow = typeof blobs.$inferSelect
export type ThumbnailRow = typeof thumbnails.$inferSelect

export const ROLE_VALUES = [
  'page', 'entity', 'textline', 'image', 'file', 'itemlink', 'tag', 'database',
] as const
