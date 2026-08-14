import type { FileID } from './FileID'
import type { AddItemForm, Item, ItemID, UpdateItemForm } from './roles'
import type { ListingParams } from './filter'

export interface ActionTable {
  addItem(form: AddItemForm): Promise<Item>
  getItem(payload: { id: ItemID }): Promise<Item>
  getItems(ids: ItemID[]): Promise<Item[]>
  updateItem(payload: { id: ItemID; data: UpdateItemForm }): Promise<{ message: 'done' }>
  deleteItem(payload: { id: ItemID }): Promise<{ message: 'done' }>
  listing(payload: ListingParams): Promise<Item[]>
  newTag(payload: { title: string; attributes?: Record<string, unknown> }): Promise<Item>
  updateTag(payload: { id: ItemID; data: { title?: string; attributes?: Record<string, unknown> } }): Promise<{ message: 'done' }>
  deleteTag(payload: { id: ItemID }): Promise<{ message: 'done' }>
  searchTag(payload: { name: string; limit?: number }): Promise<Item[]>
  getTagByTitle(payload: { title: string }): Promise<Item | null>
  generateThumb(payload: { id: ItemID }): Promise<{ file_id: FileID }>
}
