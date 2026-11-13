import fs from 'node:fs'
import { Readable } from 'node:stream'
import type { HttpBindings } from '@hono/node-server'
import { Hono, type Context } from 'hono'
import { zItemID, zThumbSize } from '@laibrary/types'
import type { BlobService } from '../blob/service'
import type { ThumbnailService } from '../thumbnails/service'
import { errorsValidation } from '../errors'

export type CreateThumbRouterOptions = {
  thumbnails: ThumbnailService
  blobs: BlobService
}

export function CreateThumbRouter({
  thumbnails,
  blobs,
}: CreateThumbRouterOptions) {
  const app = new Hono<{ Bindings: HttpBindings }>()

  app.get('/thumb/:image_id', async (c: Context<{ Bindings: HttpBindings }>) => {
    const image_parsed = zItemID.safeParse(Number.parseInt(c.req.param('image_id') ?? '', 10))
    const size_raw = c.req.query('size') ?? '384'
    const size_parsed = zThumbSize.safeParse(Number.parseInt(size_raw, 10))
    if (!image_parsed.success) {
      throw errorsValidation('非法的 image id')
    } else if (!size_parsed.success) {
      throw errorsValidation(`不支持的缩略图尺寸: ${size_raw}`)
    } else {
      const meta = await thumbnails.ensure(image_parsed.data, size_parsed.data)
      if (!(await blobs.exists(meta.id))) {
        throw new Error(`thumb blob(${meta.id}) 文件不存在`)
      } else {
        const stat = await blobs.stat(meta.id)
        return new Response(Readable.toWeb(fs.createReadStream(blobs.pathFor(meta.id))), {
          status: 200,
          headers: {
            'Content-Type': meta.mime,
            'Content-Length': String(stat.size),
            'ETag': `"${meta.id}"`,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        })
      }
    }
  })

  return app
}
