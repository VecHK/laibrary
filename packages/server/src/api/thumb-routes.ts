import fs from 'node:fs'
import Router from '@koa/router'
import { THUMB_SIZES } from '@laibrary/types'
import type { BlobService } from '../blob/service'
import type { ThumbnailService } from '../thumbnails/service'
import { AppError, validationError } from '../errors'

function errorJson(ctx: any, err: unknown): void {
  if (err instanceof AppError) {
    ctx.status = err.status
    ctx.type = 'application/json'
    ctx.body = { message: err.message, code: err.code }
    return
  }
  ctx.status = 500
  ctx.type = 'application/json'
  ctx.body = { message: err instanceof Error ? err.message : String(err), code: 'INTERNAL' }
}

export function createThumbRouter(
  thumbnails: ThumbnailService,
  blobs_service: BlobService,
) {
  const router = new Router()

  router.get('/thumb/:image_id', async (ctx) => {
    try {
      const image_id = Number.parseInt(String(ctx.params.image_id ?? ''), 10)
      const size = Number.parseInt(String(ctx.query.size ?? '384'), 10)
      if (!Number.isSafeInteger(image_id) || image_id <= 0) {
        throw validationError('非法的 image id')
      }
      if (!(THUMB_SIZES as readonly number[]).includes(size)) {
        throw validationError(`不支持的缩略图尺寸: ${size}`)
      }

      const meta = await thumbnails.ensure(image_id, size)
      if (!(await blobs_service.exists(meta.id))) {
        throw new Error(`thumb blob(${meta.id}) 文件不存在`)
      }
      const stat = await blobs_service.stat(meta.id)

      ctx.set('Content-Type', meta.mime)
      ctx.set('Content-Length', String(stat.size))
      ctx.set('ETag', `"${meta.id}"`)
      ctx.set('Cache-Control', 'public, max-age=31536000, immutable')
      ctx.body = fs.createReadStream(blobs_service.pathFor(meta.id))
    } catch (err) {
      errorJson(ctx, err)
    }
  })

  return router
}
