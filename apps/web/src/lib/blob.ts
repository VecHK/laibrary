import type { BlobID, Item, ItemID, ThumbSize } from '@laibrary/types'
import {
  createBlobUrl, createThumbUrl, uploadBlob,
} from '@laibrary/types'
import { getBaseUrl } from './settings'
import { getRpc } from './rpc'

export function blobUrl(blob_id: BlobID): string {
  return createBlobUrl(getBaseUrl() ?? '', blob_id)
}

export function thumbUrl(image_id: ItemID, size: ThumbSize): string {
  return createThumbUrl(getBaseUrl() ?? '', image_id, size)
}

export async function uploadBlobFile(file: File): Promise<{
  id: BlobID
  size: number
  mime: string
  width: number | null
  height: number | null
}> {
  const result = await uploadBlob(getBaseUrl() ?? '', file, file.name)
  return result.blob
}

export async function createImageItem(
  file: File,
  parent_id: ItemID | null,
  order_index?: number,
): Promise<Item> {
  const blob = await uploadBlobFile(file)
  return getRpc().addItem({
    role: 'image',
    title: file.name,
    parent_id,
    order_index,
    blob_id: blob.id,
    attributes: { filename: file.name },
  })
}

export async function createFileItem(
  file: File,
  parent_id: ItemID | null,
  order_index?: number,
): Promise<Item> {
  const blob = await uploadBlobFile(file)
  return getRpc().addItem({
    role: 'file',
    title: file.name,
    parent_id,
    order_index,
    blob_id: blob.id,
    attributes: { filename: file.name },
  })
}

export async function uploadImageForPage(
  file: File,
  parent_id: ItemID,
  refresh: () => void,
  showError: (message: string) => void,
): Promise<void> {
  try {
    await createImageItem(file, parent_id)
    refresh()
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err))
  }
}
