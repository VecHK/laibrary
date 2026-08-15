import { ItemID, createFileUrl, uploadFile } from '@laibrary/types'
import { getRpc } from '../lib/rpc'
import { getBaseUrl } from '../lib/settings'

export function fileUrl(fid: string): string {
  return createFileUrl(getBaseUrl() ?? '', fid as never)
}

export async function uploadImageFile(
  file: File,
  parent_id: ItemID,
  refresh: () => void,
  showError: (message: string) => void,
): Promise<void> {
  try {
    const fid = await uploadFile(getBaseUrl() ?? '', file, file.name)

    const dims = await new Promise<{ width: number; height: number }>((resolve, reject) => {
      const object_url = URL.createObjectURL(file)
      const img = new Image()
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
        URL.revokeObjectURL(object_url)
      }
      img.onerror = () => {
        reject(new Error('无法读取图片尺寸'))
        URL.revokeObjectURL(object_url)
      }
      img.src = object_url
    })

    const new_item = await getRpc().addItem({
      role: 'image',
      title: file.name,
      parent_id,
      attributes: {
        src: fid,
        filename: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        image_width: dims.width,
        image_height: dims.height,
      },
    })

    try {
      await getRpc().generateThumb({ id: new_item.id })
    } catch (err) {
      console.warn('缩略图生成失败', err)
    }

    refresh()
  } catch (err) {
    showError(err instanceof Error ? err.message : String(err))
  }
}
