import type { ActionTable } from '@laibrary/types'
import type { DB } from '../db/client'
import type { BlobService } from '../blob/service'
import type { ConfigService } from '../config/runtime'
import {
  createItem, deleteItem, getItem, getItemByUnityName, getItems,
  listItems, updateItem,
} from '../repo/items'
import {
  deleteTag, getTagByTitle, newTag, searchTag, updateTag,
} from '../repo/tags'

export function ActionRoute(
  db: DB,
  blobs_service: BlobService,
  config_service: ConfigService,
): ActionTable {
  return {
    addItem: (form) => db.transaction(tx => createItem(tx, form, blobs_service)),
    getItem: ({ id }) => getItem(db, id),
    getItems: (ids) => getItems(db, ids),
    updateItem: async ({ id, data }) => {
      await db.transaction(tx => updateItem(tx, id, data, blobs_service))
      return { message: 'done' as const }
    },
    deleteItem: async ({ id }) => {
      await db.transaction(tx => deleteItem(tx, id))
      return { message: 'done' as const }
    },
    listing: (payload) => listItems(db, payload),
    getItemByUnityName: ({ unity_name }) => getItemByUnityName(db, unity_name),
    newTag: ({ title, attributes }) => db.transaction(tx => newTag(tx, title, attributes)),
    updateTag: async ({ id, data }) => {
      await db.transaction(tx => updateTag(tx, id, data))
      return { message: 'done' as const }
    },
    deleteTag: async ({ id }) => {
      await db.transaction(tx => deleteTag(tx, id))
      return { message: 'done' as const }
    },
    searchTag: ({ name, limit }) => searchTag(db, name, limit),
    getTagByTitle: ({ title }) => getTagByTitle(db, title),
    getConfig: () => config_service.load(),
    updateConfig: async ({ key, value }) => {
      await config_service.update(key, value)
      return { message: 'done' as const }
    },
  }
}
