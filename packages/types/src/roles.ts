export type Role =
  | 'page'
  | 'entity'
  | 'text-block'
  | 'text-heading-1'
  | 'text-heading-2'
  | 'text-heading-3'
  | 'text-list'
  | 'text-todo'
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

export type ImageAlignment = 'left' | 'center' | 'right'

export interface ImageAttributes extends FileAttributes {
  readonly display_width?: number | undefined
  readonly align?: ImageAlignment | undefined
  readonly caption?: string | undefined
}

export type TextBlockRole =
  | 'text-block'
  | 'text-heading-1'
  | 'text-heading-2'
  | 'text-heading-3'
  | 'text-list'
  | 'text-todo'

export type ListKind = 'bullet' | 'number' | 'alpha'

export interface TextListAttributes extends Readonly<Record<string, unknown>> {
  readonly list_kind?: ListKind | undefined
}

export interface TextTodoAttributes extends Readonly<Record<string, unknown>> {
  readonly checked?: boolean | undefined
}

export const TEXT_BLOCK_ROLES = [
  'text-block',
  'text-heading-1',
  'text-heading-2',
  'text-heading-3',
  'text-list',
  'text-todo',
] as const satisfies readonly TextBlockRole[]

export function isTextBlockRole(role: Role): role is TextBlockRole {
  return role === 'text-block' || role === 'text-heading-1' || role === 'text-heading-2' || role === 'text-heading-3' || role === 'text-list' || role === 'text-todo'
}

export type HeadingRole = 'text-heading-1' | 'text-heading-2' | 'text-heading-3'

export function isHeadingRole(role: Role): role is HeadingRole {
  return role === 'text-heading-1' || role === 'text-heading-2' || role === 'text-heading-3'
}

export function headingLevelOfRole(role: Role): 1 | 2 | 3 | null {
  if (role === 'text-heading-1') {
    return 1
  } else if (role === 'text-heading-2') {
    return 2
  } else if (role === 'text-heading-3') {
    return 3
  } else {
    return null
  }
}

export type DatabaseFieldType = 'string' | 'number' | 'unity_name'

export interface DatabaseFieldDef {
  readonly name: string
  readonly type: DatabaseFieldType
}

export interface DatabaseAttributes {
  readonly schema: readonly DatabaseFieldDef[]
  readonly icon?: string | undefined
}

export interface PageAttributes extends Readonly<Record<string, unknown>> {
  readonly icon?: string | undefined
}

export interface ItemLinkAttributes extends Readonly<Record<string, unknown>> {
  readonly icon?: string | undefined
}

export interface RoleAttributes {
  page: PageAttributes
  entity: Readonly<Record<string, unknown>>
  'text-block': Readonly<Record<string, unknown>>
  'text-heading-1': Readonly<Record<string, unknown>>
  'text-heading-2': Readonly<Record<string, unknown>>
  'text-heading-3': Readonly<Record<string, unknown>>
  'text-list': TextListAttributes
  'text-todo': TextTodoAttributes
  image: ImageAttributes
  file: FileAttributes
  itemlink: ItemLinkAttributes
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
