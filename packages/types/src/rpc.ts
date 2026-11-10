import type {
  AddItemForm, BlobMeta, ConfigSnapshot, Item, ItemID, TextBlockRole, UpdateItemForm,
} from './roles'
import type { ListingParams } from './filter'

export interface ActionTable {
  addItem(form: AddItemForm): Promise<Item>
  getItem(payload: { id: ItemID }): Promise<Item>
  getItems(ids: readonly ItemID[]): Promise<Item[]>
  updateItem(payload: { id: ItemID; data: UpdateItemForm }): Promise<{ message: 'done' }>
  deleteItem(payload: { id: ItemID }): Promise<{ message: 'done' }>
  deleteItems(ids: readonly ItemID[]): Promise<Item[]>
  convertTextBlock(payload: {
    id: ItemID
    role: TextBlockRole
    title?: string | undefined
  }): Promise<Item>
  restoreItems(items: readonly Item[]): Promise<Item[]>
  listing(payload: ListingParams): Promise<Item[]>
  getItemByUnityName(payload: { unity_name: string }): Promise<Item | null>
  newTag(payload: { title: string; attributes?: Readonly<Record<string, unknown>> | undefined }): Promise<Item>
  updateTag(payload: { id: ItemID; data: { title?: string | undefined; attributes?: Readonly<Record<string, unknown>> | undefined } }): Promise<{ message: 'done' }>
  deleteTag(payload: { id: ItemID }): Promise<{ message: 'done' }>
  searchTag(payload: { name: string; limit?: number | undefined }): Promise<Item[]>
  getTagByTitle(payload: { title: string }): Promise<Item | null>
  getConfig(): Promise<ConfigSnapshot>
  updateConfig(payload: { key: string; value: unknown }): Promise<{ message: 'done' }>
}

export type UploadBlobResult = {
  blob: BlobMeta
  reused: boolean
}

export type { ItemID }
