import type { ActionTable } from '@laibrary/types'
import type { DB } from '../db/client'
import type { BlobService } from '../blob/service'
import type { ConfigStore } from '../config/store'
import {
  convertTextBlock, createItem, deleteItem, getItem, getItemByUnityName, getItems,
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
  db: _db,
  blobs: _blobs,
  config_store: _config_store,
}: CreateActionRouteOptions): ActionTable {
  return {
    addItem: form => _db.transaction(tx => createItem(tx, form, _blobs)),
    getItem: ({ id }) => getItem(_db, id),
    getItems: ids => getItems(_db, ids),
    updateItem: async ({ id, data }) => {
      await _db.transaction(tx => updateItem(tx, id, data, _blobs))
      return MESSAGE_DONE
    },
    deleteItem: async ({ id }) => {
      await _db.transaction(tx => deleteItem(tx, id))
      return MESSAGE_DONE
    },
    deleteItems: ids => _db.transaction(tx => deleteItems(tx, ids)),
    restoreItems: snapshots => _db.transaction(tx => restoreItems(tx, snapshots)),
    convertTextBlock: ({ id, role, title, attributes }) => _db.transaction(tx => (
      convertTextBlock(tx, id, role, title, attributes)
    )),
    listing: payload => listItems(_db, payload),
    getItemByUnityName: ({ unity_name }) => getItemByUnityName(_db, unity_name),
    newTag: ({ title, attributes }) => _db.transaction(tx => newTag(tx, title, attributes)),
    updateTag: async ({ id, data }) => {
      await _db.transaction(tx => updateTag(tx, id, data))
      return MESSAGE_DONE
    },
    deleteTag: async ({ id }) => {
      await _db.transaction(tx => deleteTag(tx, id))
      return MESSAGE_DONE
    },
    searchTag: ({ name, limit }) => searchTag(_db, name, limit),
    getTagByTitle: ({ title }) => getTagByTitle(_db, title),
    getConfig: () => _config_store.load(),
    updateConfig: async ({ key, value }) => {
      await _config_store.update(key, value)
      return MESSAGE_DONE
    },
  }
}
