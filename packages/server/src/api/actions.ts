import {
  ActionTable, constructFileID, FileID,
} from '@laibrary/types'
import type { DB } from '../db/client'
import type { FilePool } from '../blob/file-pool'
import {
  createItem, deleteItem, getItem, getItems, listItems, updateItem,
} from '../repo/items'
import {
  deleteTag, getTagByTitle, newTag, searchTag, updateTag,
} from '../repo/tags'
import { getItemRow } from '../repo/wire'
import { generateThumb } from '../utils/generate-image'

export async function generateThumbForImage(
  db: DB,
  blob: FilePool,
  id: number,
): Promise<{ file_id: FileID }> {
  const row = await getItemRow(db, id)
  if (row.role !== 'image') {
    throw new Error(`item(id=${id}) 并不是 image`)
  }

  const attrs = row.attributes as Record<string, unknown>
  const src = attrs['src']
  if (typeof src !== 'string') {
    throw new Error(`image(id=${id}) 缺少 src`)
  }

  const src_fid = src as FileID
  const source_image_path = blob.getFilePath(src_fid)
  if (!(await blob.fileExists(src_fid))) {
    throw new Error(`缩略图生成失败,FileID[${src}]不存在`)
  }

  const thumb_num = await blob.requestFileNumber()
  const thumb_fid = constructFileID(thumb_num, 'avif')
  const thumb_image_path = blob.getFilePath(thumb_fid)

  await generateThumb({ source_image_path, thumb_image_path })

  await updateItem(db, id, {
    attributes: { ...attrs, cover_src: thumb_fid } as never,
  })

  return { file_id: thumb_fid }
}

export function ActionRoute(db: DB, blob: FilePool): ActionTable {
  return {
    addItem: (form) => createItem(db, form),
    getItem: ({ id }) => getItem(db, id),
    getItems: (ids) => getItems(db, ids),
    updateItem: async ({ id, data }) => {
      await updateItem(db, id, data)
      return { message: 'done' as const }
    },
    deleteItem: async ({ id }) => {
      await deleteItem(db, id)
      return { message: 'done' as const }
    },
    listing: (payload) => listItems(db, payload),
    newTag: ({ title, attributes }) => newTag(db, title, attributes),
    updateTag: async ({ id, data }) => {
      await updateTag(db, id, data)
      return { message: 'done' as const }
    },
    deleteTag: async ({ id }) => {
      await deleteTag(db, id)
      return { message: 'done' as const }
    },
    searchTag: ({ name, limit }) => searchTag(db, name, limit),
    getTagByTitle: ({ title }) => getTagByTitle(db, title),
    generateThumb: ({ id }) => generateThumbForImage(db, blob, id),
  }
}
