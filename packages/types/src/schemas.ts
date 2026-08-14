import { z } from 'zod'
import type { FileID } from './FileID'
import type { DatabaseFieldDef, Role, RoleAttributes } from './roles'

export const zFileID = z.string().regex(
  /^\d+(\.[a-zA-Z0-9]+)?$/,
  '非法的 FileID',
).transform(v => v as FileID)

export const zFileAttributes = z.object({
  src: zFileID,
  filename: z.string().min(1),
  mime: z.string().min(1),
  size: z.number().int().nonnegative(),
  sha256: z.string().optional(),
})

export const zImageAttributes = zFileAttributes.extend({
  image_width: z.number().int().positive(),
  image_height: z.number().int().positive(),
  cover_src: zFileID.optional(),
})

export const zDatabaseFieldDef = z.object({
  name: z.string().min(1),
  type: z.enum(['string', 'number']),
})

export const zDatabaseAttributes = z.object({
  schema: z.array(zDatabaseFieldDef).superRefine((fields, ctx) => {
    const seen = new Set<string>()
    for (const field of fields) {
      if (seen.has(field.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `schema 字段名重复: ${field.name}`,
        })
      }
      seen.add(field.name)
    }
  }),
})

export const zAnyAttributes: z.ZodType<Record<string, unknown>> = z.record(
  z.string(),
  z.unknown(),
)

export const zRoleAttributesSchemas: Record<Role, z.ZodType<RoleAttributes[Role]>> = {
  item: zAnyAttributes,
  tag: zAnyAttributes,
  file: zFileAttributes,
  image: zImageAttributes,
  database: zDatabaseAttributes,
}

export function buildRowValidator(fields: DatabaseFieldDef[]): z.ZodType<Record<string, unknown>> {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const field of fields) {
    shape[field.name] = (
      field.type === 'string'
    ) ? z.string().optional() : z.number().optional()
  }
  return z.object(shape).passthrough()
}

export const zRole = z.enum(['item', 'tag', 'file', 'image', 'database'])

export const zItemID = z.number().int().positive()

export const zTags = z.array(zItemID)

export function checkAttributes(role: Role, attributes: unknown): RoleAttributes[Role] {
  const validator = zRoleAttributesSchemas[role]
  return validator.parse(attributes) as RoleAttributes[Role]
}
