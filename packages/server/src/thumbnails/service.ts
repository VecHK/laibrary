import { and, eq } from 'drizzle-orm'
import sharp from 'sharp'
import type { BlobMeta, ItemID, ThumbSize } from '@laibrary/types'
import { THUMBNAIL_SIZES } from '@laibrary/types'
import type { DB } from '../db/client'
import { items, thumbnails } from '../db/schema'
import { errorsNotFound, errorsPgCode, errorsStorage, errorsValidation } from '../errors'
import { type WriteResult, unwrapWrite, writeRun } from '../write-result'
import type { BlobService } from '../blob/service'

export type ThumbnailService = {
  readonly getExisting: (image_id: ItemID, size: ThumbSize) => Promise<BlobMeta | null>
  readonly ensure: (image_id: ItemID, size: number) => Promise<WriteResult<BlobMeta>>
}

export type CreateThumbnailServiceOptions = {
  db: DB
  blobs: BlobService
}

function isThumbSize(value: number): value is ThumbSize {
  return THUMBNAIL_SIZES.some(size => size === value)
}

export function CreateThumbnailService({
  db: _db,
  blobs: _blobs,
}: CreateThumbnailServiceOptions): ThumbnailService {
  const $_in_flight = new Map<string, Promise<BlobMeta>>()

  const getExisting = async (
    image_id: ItemID,
    size: ThumbSize,
  ): Promise<BlobMeta | null> => {
    const rows = await _db
      .select()
      .from(thumbnails)
      .where(and(eq(thumbnails.image_id, image_id), eq(thumbnails.size, size)))
      .limit(1)
    const row = rows[0]
    return row === undefined ? null : _blobs.requireMeta(row.blob_id)
  }

  const generate = async (image_id: ItemID, size: ThumbSize): Promise<BlobMeta> => {
    const image_rows = await _db
      .select()
      .from(items)
      .where(eq(items.id, image_id))
      .limit(1)
    const image = image_rows[0]
    if (image === undefined) {
      throw errorsNotFound(`item(id=${image_id}) not found`)
    } else if (image.role !== 'image') {
      throw errorsValidation(`item(id=${image_id}) 并不是 image`)
    } else if (image.blob_id === null) {
      throw errorsNotFound(`image(id=${image_id}) 缺少 blob`)
    } else {
      const source = await _blobs.getMeta(image.blob_id)
      if (source === null) {
        throw errorsNotFound(`blob(${image.blob_id}) not found`)
      } else if (!(await _blobs.exists(source.id))) {
        throw errorsNotFound(`blob(${source.id}) 文件不存在`)
      } else {
        let $output: { data: Buffer, info: { width: number, height: number } }
        try {
          $output = await sharp(_blobs.pathFor(source.id))
            .rotate()
            .flatten({ background: '#FFFFFF' })
            .resize(size, size, { fit: 'inside', withoutEnlargement: true })
            .avif({ quality: 40, effort: 4 })
            .toBuffer({ resolveWithObject: true })
        } catch (cause) {
          throw errorsStorage(`生成缩略图失败: image(${image_id}) size=${size}`, cause)
        }

        const thumb = unwrapWrite(await _blobs.putBuffer($output.data, 'image/avif'))
        try {
          await _db
            .insert(thumbnails)
            .values({
              image_id,
              size,
              blob_id: thumb.blob.id,
              width: $output.info.width,
              height: $output.info.height,
            })
            .onConflictDoNothing()
        } catch (cause) {
          if (errorsPgCode(cause) === '23503') {
            throw errorsNotFound(`image(id=${image_id}) not found`)
          } else {
            throw errorsStorage('写入缩略图记录失败', cause)
          }
        }

        const saved = await getExisting(image_id, size)
        return saved === null ? thumb.blob : saved
      }
    }
  }

  const ensure = (image_id: ItemID, size: number): Promise<WriteResult<BlobMeta>> => writeRun(async () => {
    if (!Number.isSafeInteger(image_id) || image_id <= 0) {
      throw errorsValidation('非法的 image id')
    } else if (!isThumbSize(size)) {
      throw errorsValidation(`不支持的缩略图尺寸: ${size}`)
    } else {
      const existing = await getExisting(image_id, size)
      if (existing !== null) {
        return existing
      } else {
        const key = `${image_id}:${size}`
        const running = $_in_flight.get(key)
        if (running !== undefined) {
          return await running
        } else {
          const task = generate(image_id, size).finally(() => {
            $_in_flight.delete(key)
          })
          $_in_flight.set(key, task)
          return await task
        }
      }
    }
  })

  return { getExisting, ensure }
}
