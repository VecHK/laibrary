export type Role =
  | 'page'
  | 'entity'
  | 'textline'
  | 'image'
  | 'file'
  | 'itemlink'
  | 'tag'
  | 'database'

declare const ItemIDBrand: unique symbol

export type ItemID = number & { readonly [ItemIDBrand]: 'ItemID' }

/** Content-addressed blob id: lowercase SHA-256 hex. */
declare const BlobIDBrand: unique symbol
export type BlobID = string & { readonly [BlobIDBrand]: 'BlobID' }

/** Globally unique, machine-readable item name. */
declare const UnityNameBrand: unique symbol
export type UnityName = string & { readonly [UnityNameBrand]: 'UnityName' }

/** Open semantic kind. Only meaningful on role='entity'. */
export type Kind = string

export interface BlobMeta {
  readonly id: BlobID
  readonly size: number
  readonly mime: string
  readonly width: number | null
  readonly height: number | null
}

export interface FileAttributes {
  readonly filename: string
}

export type ImageAttributes = FileAttributes

export type DatabaseFieldType = 'string' | 'number' | 'unity_name'

export interface DatabaseFieldDef {
  readonly name: string
  readonly type: DatabaseFieldType
}

export interface DatabaseAttributes {
  readonly schema: readonly DatabaseFieldDef[]
}

export interface RoleAttributes {
  page: Readonly<Record<string, unknown>>
  entity: Readonly<Record<string, unknown>>
  textline: Readonly<Record<string, unknown>>
  image: ImageAttributes
  file: FileAttributes
  itemlink: Readonly<Record<string, unknown>>
  tag: Readonly<Record<string, unknown>>
  database: DatabaseAttributes
}

export interface ItemBase {
  readonly id: ItemID
  readonly role: Role
  readonly kind: Kind | null
  readonly unity_name: UnityName | null
  readonly title: string
  readonly attributes: RoleAttributes[Role]
  readonly tags: readonly ItemID[]
  readonly parent_id: ItemID | null
  readonly order_index: number
  readonly blob: BlobMeta | null
  readonly target_id: ItemID | null
  readonly create_date: string
  readonly update_date: string
}

export type Item<R extends Role = Role> = ItemBase & {
  readonly role: R
  readonly attributes: RoleAttributes[R]
}

export interface AddItemForm<R extends Role = Role> {
  role: R
  kind?: Kind | undefined
  unity_name?: string | undefined
  title?: string | undefined
  attributes?: RoleAttributes[R] | undefined
  tags?: readonly ItemID[] | undefined
  parent_id?: ItemID | null | undefined
  order_index?: number | undefined
  blob_id?: BlobID | undefined
  target_id?: ItemID | undefined
}

export interface UpdateItemForm {
  title?: string | undefined
  attributes?: RoleAttributes[Role] | undefined
  tags?: readonly ItemID[] | undefined
  parent_id?: ItemID | null | undefined
  order_index?: number | undefined
  target_id?: ItemID | undefined
}

export type ConfigValueType = 'string' | 'number' | 'boolean' | 'json'

export interface ConfigEntry {
  readonly key: string
  readonly title: string
  readonly type: ConfigValueType
  readonly value: unknown
}

export interface ConfigSnapshot {
  readonly version: number
  readonly entries: readonly ConfigEntry[]
}
