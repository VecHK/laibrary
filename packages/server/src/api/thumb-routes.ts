import fs from 'node:fs'
import Router from '@koa/router'
import type { Context } from 'koa'
import { zItemID, zThumbSize } from '@laibrary/types'
import type { BlobService } from '../blob/service'
import type { ThumbnailService } from '../thumbnails/service'
import { errorsIsAppError, errorsValidation } from '../errors'

function errorJson(ctx: Context, err: unknown): void {
  if (errorsIsAppError(err)) {
    ctx.status = err.status
    ctx.type = 'application/json'
    ctx.body = { message: err.message, code: err.code }
  } else {
    ctx.status = 500
    ctx.type = 'application/json'
    ctx.body = { message: err instanceof Error ? err.message : String(err), code: 'INTERNAL' }
  }
}

export type CreateThumbRouterOptions = {
  thumbnails: ThumbnailService
  blobs: BlobService
}

export function CreateThumbRouter({
  thumbnails,
  blobs,
}: CreateThumbRouterOptions) {
  const router = new Router()

  router.get('/thumb/:image_id', async ctx => {
    try {
      const image_parsed = zItemID.safeParse(Number.parseInt(String(ctx.params.image_id ?? ''), 10))
      const size_parsed = zThumbSize.safeParse(Number.parseInt(String(ctx.query.size ?? '384'), 10))
      if (!image_parsed.success) {
        throw errorsValidation('非法的 image id')
      } else if (!size_parsed.success) {
        throw errorsValidation(`不支持的缩略图尺寸: ${String(ctx.query.size)}`)
      }
      const image_id = image_parsed.data
      const size = size_parsed.data
      const meta = await thumbnails.ensure(image_id, size)
      if (!(await blobs.exists(meta.id))) {
        throw new Error(`thumb blob(${meta.id}) 文件不存在`)
      } else {
        const stat = await blobs.stat(meta.id)
        ctx.set('Content-Type', meta.mime)
        ctx.set('Content-Length', String(stat.size))
        ctx.set('ETag', `"${meta.id}"`)
        ctx.set('Cache-Control', 'public, max-age=31536000, immutable')
        ctx.body = fs.createReadStream(blobs.pathFor(meta.id))
      }
    } catch (err) {
      errorJson(ctx, err)
    }
  })

  return router
}
