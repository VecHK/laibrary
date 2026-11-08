import { and, eq } from 'drizzle-orm'
import sharp from 'sharp'
import {
  THUMB_SIZES, type BlobMeta, type ItemID, type ThumbSize,
} from '@laibrary/types'
import type { DB } from '../db/client'
import { items, thumbnails } from '../db/schema'
import { notFound, pgErrorCode, storageError, validationError } from '../errors'
import type { BlobService } from '../blob/service'

function isThumbSize(value: number): value is ThumbSize {
  return (THUMB_SIZES as readonly number[]).includes(value)
}

export class ThumbnailService {
  private readonly in_flight = new Map<string, Promise<BlobMeta>>()

  constructor(
    private readonly db: DB,
    private readonly blobs: BlobService,
  ) {}

  async getExisting(image_id: ItemID, size: ThumbSize): Promise<BlobMeta | null> {
    const rows = await this.db
      .select()
      .from(thumbnails)
      .where(and(eq(thumbnails.image_id, image_id), eq(thumbnails.size, size)))
      .limit(1)
    const row = rows[0]
    if (row === undefined) return null
    return this.blobs.requireMeta(row.blob_id as never)
  }

  async ensure(image_id: ItemID, size: number): Promise<BlobMeta> {
    if (!Number.isSafeInteger(image_id) || image_id <= 0) {
      throw validationError('非法的 image id')
    }
    if (!isThumbSize(size)) {
      throw validationError(`不支持的缩略图尺寸: ${size}`)
    }

    const existing = await this.getExisting(image_id, size)
    if (existing !== null) return existing

    const key = `${image_id}:${size}`
    const running = this.in_flight.get(key)
    if (running !== undefined) return running

    const task = this.generate(image_id, size).finally(() => {
      this.in_flight.delete(key)
    })
    this.in_flight.set(key, task)
    return task
  }

  private async generate(image_id: ItemID, size: ThumbSize): Promise<BlobMeta> {
    const image_rows = await this.db
      .select()
      .from(items)
      .where(eq(items.id, image_id))
      .limit(1)
    const image = image_rows[0]
    if (image === undefined) throw notFound(`item(id=${image_id}) not found`)
    if (image.role !== 'image') {
      throw validationError(`item(id=${image_id}) 并不是 image`)
    }
    if (image.blob_id === null) {
      throw notFound(`image(id=${image_id}) 缺少 blob`)
    }

    const source = await this.blobs.getMeta(image.blob_id as never)
    if (source === null) throw notFound(`blob(${image.blob_id}) not found`)
    if (!(await this.blobs.exists(source.id))) {
      throw notFound(`blob(${source.id}) 文件不存在`)
    }

    let output: { data: Buffer, info: { width: number, height: number } }
    try {
      output = await sharp(this.blobs.pathFor(source.id))
        .rotate()
        .flatten({ background: '#FFFFFF' })
        .resize(size, size, { fit: 'inside', withoutEnlargement: true })
        .avif({ quality: 40, effort: 4 })
        .toBuffer({ resolveWithObject: true })
    } catch (err) {
      throw storageError(`生成缩略图失败: image(${image_id}) size=${size}`, err)
    }

    const thumb = await this.blobs.putBuffer(output.data, 'image/avif')

    try {
      await this.db
        .insert(thumbnails)
        .values({
          image_id,
          size,
          blob_id: thumb.blob.id,
          width: output.info.width,
          height: output.info.height,
        })
        .onConflictDoNothing()
    } catch (err) {
      // The image may have been deleted while the thumbnail was generated.
      if (pgErrorCode(err) === '23503') {
        throw notFound(`image(id=${image_id}) not found`)
      }
      throw storageError('写入缩略图记录失败', err)
    }

    const saved = await this.getExisting(image_id, size)
    if (saved !== null) return saved
    return thumb.blob
  }
}
