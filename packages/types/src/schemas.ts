import { z } from 'zod'
import type {
  BlobID, DatabaseFieldDef, ItemID, Role, RoleAttributes, UnityName,
} from './roles'
import { as } from './as'
import {
  __THUMBNAIL_SIZES__, type ThumbSize,
} from './constants'

export const zBlobID = z
  .string()
  .regex(/^[0-9a-f]{64}$/, '非法的 BlobID')
  .transform(value => as<BlobID>(value))

export const zUnityName = z
  .string()
  .min(1, 'unity_name 不能为空')
  .max(200, 'unity_name 太长')
  .regex(/^[a-z][a-z0-9._-]*$/, 'unity_name 只能使用小写字母、数字、._-')
  .transform(value => as<UnityName>(value))

export const zKind = z
  .string()
  .min(1, 'kind 不能为空')
  .max(64, 'kind 太长')
  .regex(/^[a-z][a-z0-9._-]*$/, 'kind 只能使用小写字母、数字、._-')

export const zRole = z.enum([
  'page', 'entity', 'textline', 'image', 'file', 'itemlink', 'tag', 'database',
])
export const zThumbSize = z.custom<ThumbSize>(value => (
  typeof value === 'number' && __THUMBNAIL_SIZES__.some(size => size === value)
))

export const zItemID = z
  .number()
  .int()
  .positive()
  .transform(value => as<ItemID>(value))
export const zTags = z.array(zItemID)

export const zBlobMeta = z.object({
  id: zBlobID,
  size: z.number().int().nonnegative(),
  mime: z.string().min(1),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
})

export const zFileAttributes = z.object({
  filename: z.string().min(1).max(512),
}).strict()

export const zImageAttributes = zFileAttributes.extend({
  display_width: z.number().int().min(80).max(1440).optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  caption: z.string().max(2000).optional(),
})

export const zIcon = z.string().trim().min(1).max(16)

export const zDatabaseFieldType = z.enum(['string', 'number', 'unity_name'])

export const zDatabaseFieldDef = z.object({
  name: z.string().min(1).max(128),
  type: zDatabaseFieldType,
}).strict()

export const zDatabaseAttributes = z.object({
  icon: zIcon.optional(),
  schema: z.array(zDatabaseFieldDef).superRefine((fields, ctx) => {
    const seen = new Set<string>()
    let unity_fields = 0
    for (const field of fields) {
      if (seen.has(field.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `schema 字段名重复: ${field.name}`,
        })
      }
      seen.add(field.name)
      if (field.type === 'unity_name') {
        unity_fields += 1
      }
    }
    if (unity_fields > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'schema 最多只能有一个 unity_name 字段',
      })
    }
  }),
}).strict()

export const zAnyAttributes: z.ZodType<Record<string, unknown>> = z.record(
  z.string(),
  z.unknown(),
)

export const zPageAttributes = zAnyAttributes.superRefine((attributes, ctx) => {
  const icon = attributes['icon']
  if (icon !== undefined && !zIcon.safeParse(icon).success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'icon 必须是 1-16 字符的 emoji 文本',
      path: ['icon'],
    })
  }
})

export const zRoleAttributesSchemas: Record<Role, z.ZodType<RoleAttributes[Role]>> = {
  page: zPageAttributes,
  entity: zAnyAttributes,
  textline: zAnyAttributes,
  image: zImageAttributes,
  file: zFileAttributes,
  itemlink: zPageAttributes,
  tag: zAnyAttributes,
  database: zDatabaseAttributes,
}

/**
 * Row validation for a database parent. `unity_name` is backed by the item
 * column, not by attributes, so it is intentionally excluded here.
 */
export function itemBuildRowValidator(
  fields: readonly DatabaseFieldDef[],
): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const field of fields) {
    if (field.type !== 'unity_name') {
      shape[field.name] = (
        field.type === 'string'
      ) ? z.string().nullable().optional() : z.number().nullable().optional()
    }
  }
  return z.object(shape).passthrough()
}

export function itemCheckAttributes(
  role: Role,
  attributes: unknown,
): RoleAttributes[Role] {
  return zRoleAttributesSchemas[role].parse(attributes)
}

const zAddItemBase = z.object({
  role: zRole,
  kind: zKind.optional(),
  unity_name: zUnityName.optional(),
  title: z.string().max(100_000).optional(),
  attributes: zAnyAttributes.optional(),
  tags: z.array(zItemID).max(1000).optional(),
  parent_id: zItemID.nullable().optional(),
  order_index: z.number().finite().optional(),
  blob_id: zBlobID.optional(),
  target_id: zItemID.optional(),
}).strict()

export const zAddItemForm = zAddItemBase.superRefine((value, ctx) => {
  if (value.role === 'entity') {
    if (value.kind === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'entity 必须提供 kind', path: ['kind'] })
    }
  } else if (value.kind !== undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '只有 entity 允许 kind', path: ['kind'] })
  }

  const needs_blob = value.role === 'file' || value.role === 'image'
  if (needs_blob && value.blob_id === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${value.role} 必须提供 blob_id`, path: ['blob_id'] })
  } else if (!needs_blob && value.blob_id !== undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '只有 file/image 允许 blob_id', path: ['blob_id'] })
  }

  if (value.role === 'itemlink') {
    if (value.target_id === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'itemlink 必须提供 target_id', path: ['target_id'] })
    }
  } else if (value.target_id !== undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: '只有 itemlink 允许 target_id', path: ['target_id'] })
  }
})

export const zUpdateItemForm = z.object({
  title: z.string().max(100_000).optional(),
  attributes: zAnyAttributes.optional(),
  tags: z.array(zItemID).max(1000).optional(),
  parent_id: zItemID.nullable().optional(),
  order_index: z.number().finite().optional(),
  target_id: zItemID.optional(),
}).strict()

export const zItem = z.object({
  id: zItemID,
  role: zRole,
  kind: zKind.nullable(),
  unity_name: zUnityName.nullable(),
  title: z.string(),
  attributes: zAnyAttributes,
  tags: z.array(zItemID),
  parent_id: zItemID.nullable(),
  order_index: z.number().finite(),
  blob: zBlobMeta.nullable(),
  target_id: zItemID.nullable(),
  create_date: z.string(),
  update_date: z.string(),
})

export const zItems = z.array(zItem)

export const zConfigEntry = z.object({
  key: z.string(),
  title: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'json']),
  value: z.custom<unknown>(() => true),
}).transform(entry => ({ ...entry, value: entry.value }))

export const zConfigSnapshot = z.object({
  version: z.number(),
  entries: z.array(zConfigEntry),
})

export const zMessage = z.object({ message: z.literal('done') })

export const zErrorBody = z.object({
  message: z.string(),
  code: z.string(),
  issues: z.unknown().optional(),
})

export const zBlobUploadResponse = z.object({
  blob: zBlobMeta,
  reused: z.boolean(),
})

export type AddItemPayload = z.infer<typeof zAddItemForm>
export type UpdateItemPayload = z.infer<typeof zUpdateItemForm>
export type BlobMetaPayload = z.infer<typeof zBlobMeta>
