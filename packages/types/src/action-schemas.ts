import { z } from 'zod'
import type { ActionName } from './rpc-client'
import {
  zAddItemForm, zItem, zItemID, zKind, zRole, zTextBlockRole, zUnityName, zUpdateItemForm,
} from './schemas'

const zRuleBase = {
  logic: z.enum(['and', 'or']),
  invert: z.boolean().optional(),
}

export const zFilterRule = z.discriminatedUnion('name', [
  z.object({
    name: z.literal('role'),
    input: z.union([zRole, z.array(zRole)]),
    ...zRuleBase,
  }).strict(),
  z.object({
    name: z.literal('kind'),
    input: zKind,
    ...zRuleBase,
  }).strict(),
  z.object({
    name: z.literal('unity_name'),
    input: zUnityName,
    ...zRuleBase,
  }).strict(),
  z.object({
    name: z.literal('title'),
    input: z.string(),
    ...zRuleBase,
  }).strict(),
  z.object({
    name: z.literal('has_tag'),
    input: zItemID,
    ...zRuleBase,
  }).strict(),
  z.object({
    name: z.literal('empty_tag'),
    input: z.null(),
    ...zRuleBase,
  }).strict(),
  z.object({
    name: z.literal('parent'),
    input: zItemID.nullable(),
    ...zRuleBase,
  }).strict(),
  z.object({
    name: z.literal('attribute_equal'),
    input: z.object({
      name: z.string().min(1).max(128),
      value: z.union([z.string(), z.number(), z.boolean()]),
    }).strict(),
    ...zRuleBase,
  }).strict(),
])

export const zFilterGroup = z.object({
  logic: z.enum(['and', 'or']),
  invert: z.boolean(),
  rules: z.array(zFilterRule).max(50),
}).strict()

export const zListingParams = z.object({
  sort_by: z.enum(['id', 'create_date', 'update_date', 'order_index']).optional(),
  sort_field: z.object({
    name: z.string().min(1).max(128),
    type: z.enum(['string', 'number']),
  }).strict().optional(),
  after_id: zItemID.optional(),
  desc: z.boolean().optional(),
  limit: z.number().int().min(0).max(10_000),
  filter_rules: z.array(zFilterRule).max(50).optional(),
  filter_groups: z.array(zFilterGroup).max(20).optional(),
}).strict()

export const zActionPayloads = {
  addItem: zAddItemForm,
  getItem: z.object({ id: zItemID }).strict(),
  getItems: z.array(zItemID).max(1000),
  updateItem: z.object({ id: zItemID, data: zUpdateItemForm }).strict(),
  deleteItem: z.object({ id: zItemID }).strict(),
  deleteItems: z.array(zItemID).max(1000),
  restoreItems: z.array(zItem).max(1000),
  convertTextBlock: z.object({
    id: zItemID,
    role: zTextBlockRole,
    title: z.string().max(100_000).optional(),
    attributes: z.record(z.string(), z.unknown()).optional(),
  }).strict(),
  listing: zListingParams,
  getItemByUnityName: z.object({ unity_name: zUnityName }).strict(),
  newTag: z.object({
    title: z.string().min(1).max(200),
    attributes: z.record(z.string(), z.unknown()).optional(),
  }).strict(),
  updateTag: z.object({
    id: zItemID,
    data: z.object({
      title: z.string().min(1).max(200).optional(),
      attributes: z.record(z.string(), z.unknown()).optional(),
    }).strict(),
  }).strict(),
  deleteTag: z.object({ id: zItemID }).strict(),
  searchTag: z.object({
    name: z.string(),
    limit: z.number().int().min(0).max(1000).optional(),
  }).strict(),
  getTagByTitle: z.object({ title: z.string() }).strict(),
  getConfig: z.unknown(),
  updateConfig: z.object({
    key: zUnityName,
    value: z.unknown().refine(value => value !== undefined, {
      message: '配置值不能是 undefined',
    }),
  }).strict(),
} satisfies Record<ActionName, z.ZodTypeAny>

export type ListingPayload = z.infer<typeof zListingParams>
