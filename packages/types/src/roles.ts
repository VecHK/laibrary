export type Role =
  | 'page'
  | 'entity'
  | 'textline'
  | 'image'
  | 'file'
  | 'itemlink'
  | 'tag'
  | 'database'

export type ItemID = number

/** Content-addressed blob id: lowercase SHA-256 hex. */
export type BlobID = string & { __BLOB_ID__: never }

/** Globally unique, machine-readable item name. */
export type UnityName = string & { __UNITY_NAME__: never }

/** Open semantic kind. Only meaningful on role='entity'. */
export type Kind = string

export const THUMB_SIZES = [96, 384, 800, 1440] as const
export type ThumbSize = (typeof THUMB_SIZES)[number]

export interface BlobMeta {
  id: BlobID
  size: number
  mime: string
  width: number | null
  height: number | null
}

export interface FileAttributes {
  filename: string
}

export type ImageAttributes = FileAttributes

export type DatabaseFieldType = 'string' | 'number' | 'unity_name'

export interface DatabaseFieldDef {
  name: string
  type: DatabaseFieldType
}

export interface DatabaseAttributes {
  schema: DatabaseFieldDef[]
}

export interface RoleAttributes {
  page: Record<string, unknown>
  entity: Record<string, unknown>
  textline: Record<string, unknown>
  image: ImageAttributes
  file: FileAttributes
  itemlink: Record<string, unknown>
  tag: Record<string, unknown>
  database: DatabaseAttributes
}

export interface ItemBase {
  id: ItemID
  role: Role
  kind: Kind | null
  unity_name: UnityName | null
  title: string
  attributes: RoleAttributes[Role]
  tags: ItemID[]
  parent_id: ItemID | null
  order_index: number
  blob: BlobMeta | null
  target_id: ItemID | null
  create_date: string
  update_date: string
}

export type Item<R extends Role = Role> = ItemBase & {
  role: R
  attributes: RoleAttributes[R]
}

export interface AddItemForm<R extends Role = Role> {
  role: R
  kind?: Kind
  unity_name?: string
  title?: string
  attributes?: RoleAttributes[R]
  tags?: ItemID[]
  parent_id?: ItemID | null
  order_index?: number
  blob_id?: BlobID
  target_id?: ItemID
}

export interface UpdateItemForm {
  title?: string
  attributes?: RoleAttributes[Role]
  tags?: ItemID[]
  parent_id?: ItemID | null
  order_index?: number
  target_id?: ItemID
}

export type ConfigValueType = 'string' | 'number' | 'boolean' | 'json'

export interface ConfigEntry {
  key: string
  title: string
  type: ConfigValueType
  value: unknown
}

export interface ConfigSnapshot {
  version: number
  entries: ConfigEntry[]
}

export const SYSTEM_CONFIG_UNITY_NAME = 'sys.config'
export const SYSTEM_UNITY_PREFIX = 'sys.'
