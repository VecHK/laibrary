import type { BlobID, Item, ItemID, ThumbSize } from '@laibrary/types'
import {
  createBlobUrl, createThumbUrl, uploadBlob,
} from '@laibrary/types'
import type { ApiContext } from '../modules/types'

export function blobUrl(base_url: string, blob_id: BlobID): string {
  return createBlobUrl(base_url, blob_id)
}

export function thumbUrl(base_url: string, image_id: ItemID, size: ThumbSize): string {
  return createThumbUrl(base_url, image_id, size)
}

export function mediaKindForFile(file: File): 'image' | 'file' {
  if (file.type.startsWith('image/')) {
    return 'image'
  } else if (file.type.length === 0 && /\.(png|jpe?g|gif|webp|avif|svg)$/i.test(file.name)) {
    return 'image'
  } else {
    return 'file'
  }
}

export async function uploadBlobFile(api: ApiContext, file: File): Promise<{
  id: BlobID
  size: number
  mime: string
  width: number | null
  height: number | null
}> {
  const result = await uploadBlob({ base_url: api.base_url, file, filename: file.name })
  return result.blob
}

export type CreateMediaItemOptions = {
  api: ApiContext
  file: File
  parent_id: ItemID | null
  order_index?: number | undefined
}

export async function createImageItem({
  api, file, parent_id, order_index,
}: CreateMediaItemOptions): Promise<Item> {
  const blob = await uploadBlobFile(api, file)
  return api.rpc.addItem({
    role: 'image',
    title: file.name,
    parent_id,
    order_index,
    blob_id: blob.id,
    attributes: { filename: file.name, display_width: 480 },
  })
}

export async function createFileItem({
  api, file, parent_id, order_index,
}: CreateMediaItemOptions): Promise<Item> {
  const blob = await uploadBlobFile(api, file)
  return api.rpc.addItem({
    role: 'file',
    title: file.name,
    parent_id,
    order_index,
    blob_id: blob.id,
    attributes: { filename: file.name, display_width: 480 },
  })
}
