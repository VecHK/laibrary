import type { ActionTable } from '@laibrary/types'
import type { DB } from '../db/client'
import type { BlobService } from '../blob/service'
import type { ConfigStore } from '../config/store'
import {
  createItem, deleteItem, getItem, getItemByUnityName, getItems,
  updateItem,
} from '../repo/items'
import { listItems } from '../repo/item-listing'
import { deleteItems, restoreItems } from '../repo/item-batch'
import {
  deleteTag, getTagByTitle, newTag, searchTag, updateTag,
} from '../repo/tags'

export type CreateActionRouteOptions = {
  db: DB
  blobs: BlobService
  config_store: ConfigStore
}

const MESSAGE_DONE = { message: 'done' as const }

export function CreateActionRoute({
  db,
  blobs,
  config_store,
}: CreateActionRouteOptions): ActionTable {
  return {
    addItem: form => db.transaction(tx => createItem(tx, form, blobs)),
    getItem: ({ id }) => getItem(db, id),
    getItems: ids => getItems(db, ids),
    updateItem: async ({ id, data }) => {
      await db.transaction(tx => updateItem(tx, id, data, blobs))
      return MESSAGE_DONE
    },
    deleteItem: async ({ id }) => {
      await db.transaction(tx => deleteItem(tx, id))
      return MESSAGE_DONE
    },
    deleteItems: ids => db.transaction(tx => deleteItems(tx, ids)),
    restoreItems: snapshots => db.transaction(tx => restoreItems(tx, snapshots)),
    listing: payload => listItems(db, payload),
    getItemByUnityName: ({ unity_name }) => getItemByUnityName(db, unity_name),
    newTag: ({ title, attributes }) => db.transaction(tx => newTag(tx, title, attributes)),
    updateTag: async ({ id, data }) => {
      await db.transaction(tx => updateTag(tx, id, data))
      return MESSAGE_DONE
    },
    deleteTag: async ({ id }) => {
      await db.transaction(tx => deleteTag(tx, id))
      return MESSAGE_DONE
    },
    searchTag: ({ name, limit }) => searchTag(db, name, limit),
    getTagByTitle: ({ title }) => getTagByTitle(db, title),
    getConfig: () => config_store.load(),
    updateConfig: async ({ key, value }) => {
      await config_store.update(key, value)
      return MESSAGE_DONE
    },
  }
}
