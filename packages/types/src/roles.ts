import type { FileID } from './FileID'

export type Role = 'custom' | 'tag' | 'textline' | 'file' | 'image' | 'database'

export type ItemID = number

export interface FileAttributes {
  src: FileID
  filename: string
  mime: string
  size: number
  sha256?: string
}

export interface ImageAttributes extends FileAttributes {
  image_width: number
  image_height: number
  cover_src?: FileID
}

export interface DatabaseFieldDef {
  name: string
  type: 'string' | 'number'
}

export interface DatabaseAttributes {
  schema: DatabaseFieldDef[]
}

export interface RoleAttributes {
  custom: Record<string, unknown>
  tag: Record<string, unknown>
  textline: Record<string, unknown>
  file: FileAttributes
  image: ImageAttributes
  database: DatabaseAttributes
}

export interface ItemBase {
  id: ItemID
  role: Role
  title: string
  attributes: RoleAttributes[Role]
  tags: ItemID[]
  parent_id: ItemID | null
  order_index: number
  create_date: string
  update_date: string
}

export type Item<R extends Role = Role> = ItemBase & {
  role: R
  attributes: RoleAttributes[R]
}

export interface AddItemForm<R extends Role = Role> {
  role: R
  title?: string
  attributes?: RoleAttributes[R]
  tags?: ItemID[]
  parent_id?: ItemID | null
  order_index?: number
}

export interface UpdateItemForm {
  role?: Role
  title?: string
  attributes?: RoleAttributes[Role]
  tags?: ItemID[]
  parent_id?: ItemID | null
  order_index?: number
}
