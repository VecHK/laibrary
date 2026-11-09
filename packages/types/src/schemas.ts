import { z } from 'zod'
import type {
  BlobID, DatabaseFieldDef, Role, RoleAttributes, UnityName,
} from './roles'

export const zBlobID = z
  .string()
  .regex(/^[0-9a-f]{64}$/, '非法的 BlobID')
  .transform(value => value as BlobID)

export const zUnityName = z
  .string()
  .min(1, 'unity_name 不能为空')
  .max(200, 'unity_name 太长')
  .regex(/^[a-z][a-z0-9._-]*$/, 'unity_name 只能使用小写字母、数字、._-')
  .transform(value => value as UnityName)

export const zKind = z
  .string()
  .min(1, 'kind 不能为空')
  .max(64, 'kind 太长')
  .regex(/^[a-z][a-z0-9._-]*$/, 'kind 只能使用小写字母、数字、._-')

export const zRole = z.enum([
  'page', 'entity', 'textline', 'image', 'file', 'itemlink', 'tag', 'database',
])

export const zItemID = z.number().int().positive()
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

export const zImageAttributes = zFileAttributes

export const zDatabaseFieldType = z.enum(['string', 'number', 'unity_name'])

export const zDatabaseFieldDef = z.object({
  name: z.string().min(1).max(128),
  type: zDatabaseFieldType,
}).strict()

export const zDatabaseAttributes = z.object({
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

export const zRoleAttributesSchemas: Record<Role, z.ZodType<RoleAttributes[Role]>> = {
  page: zAnyAttributes,
  entity: zAnyAttributes,
  textline: zAnyAttributes,
  image: zImageAttributes,
  file: zFileAttributes,
  itemlink: zAnyAttributes,
  tag: zAnyAttributes,
  database: zDatabaseAttributes,
}

/**
 * Row validation for a database parent. `unity_name` is backed by the item
 * column, not by attributes, so it is intentionally excluded here.
 */
export function buildRowValidator(
  fields: DatabaseFieldDef[],
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

export function checkAttributes(
  role: Role,
  attributes: unknown,
): RoleAttributes[Role] {
  return zRoleAttributesSchemas[role].parse(attributes) as RoleAttributes[Role]
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

export type AddItemPayload = z.infer<typeof zAddItemForm>
export type UpdateItemPayload = z.infer<typeof zUpdateItemForm>
export type BlobMetaPayload = z.infer<typeof zBlobMeta>
