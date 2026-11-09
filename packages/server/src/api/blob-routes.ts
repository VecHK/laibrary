import fs from 'node:fs'
import path from 'node:path'
import Router, { type RouterContext } from '@koa/router'
import type { Context } from 'koa'
import { koaBody } from 'koa-body'
import { zBlobID } from '@laibrary/types'
import type { BootstrapConfig } from '../config/bootstrap'
import type { BlobService } from '../blob/service'
import { AppError, badRequest, notFound, storageError } from '../errors'
import { initDirectorySync } from '../utils/directory'

function json(ctx: Context, status: number, body: unknown): void {
  ctx.status = status
  ctx.type = 'application/json'
  ctx.body = body
}

function errorJson(ctx: Context, err: unknown): void {
  if (err instanceof AppError) {
    json(ctx, err.status, { message: err.message, code: err.code })
    return
  }
  const message = err instanceof Error ? err.message : String(err)
  json(ctx, 500, { message, code: 'INTERNAL' })
}

function detectSingleFile(ctx: Context) {
  const { files } = ctx.request
  if (files === undefined) {throw badRequest('upload failure: missing files')}
  if (Object.keys(files).length > 1) {
    throw badRequest("upload failure: only 'file' field is allowed")
  }
  const file = files['file']
  if (file === undefined) {throw badRequest("upload failure: require 'file' field")}
  if (Array.isArray(file)) {throw badRequest('upload failure: single upload required')}
  return file
}

function parseRange(range: string | undefined, size: number): { start: number, end: number } | null {
  if (range === undefined) {return null}
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
  if (match === null) {return null}
  const [, start_raw, end_raw] = match
  if (start_raw === '' && end_raw === '') {return null}
  let start: number
  let end: number
  if (start_raw === '') {
    const suffix = Number.parseInt(end_raw as string, 10)
    if (!Number.isFinite(suffix) || suffix <= 0) {return null}
    start = Math.max(0, size - suffix)
    end = size - 1
  } else {
    start = Number.parseInt(start_raw as string, 10)
    end = end_raw === '' ? size - 1 : Number.parseInt(end_raw as string, 10)
  }
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return null
  }
  return { start, end: Math.min(end, size - 1) }
}

export function createBlobRouter(
  config: BootstrapConfig,
  blobs_service: BlobService,
  get_max_upload_bytes: () => Promise<number>,
) {
  const router = new Router()
  initDirectorySync(config.upload_temp_path)
  for (const temp_file of fs.readdirSync(config.upload_temp_path)) {
    try {
      fs.unlinkSync(path.join(config.upload_temp_path, temp_file))
    } catch (err) {
      console.error('清理上传临时文件失败', err)
    }
  }

  const upload = koaBody({
    multipart: true,
    formidable: {
      maxFileSize: 1024 * 1024 * 1024,
      multiples: false,
      maxFiles: 1,
      maxFields: 1,
      allowEmptyFiles: false,
      keepExtensions: true,
      uploadDir: config.upload_temp_path,
      filter: (part) => part.name === 'file',
    },
  })

  router.post('/blob', upload, async (ctx) => {
    let temp_path: string | null = null
    try {
      const uploaded = detectSingleFile(ctx)
      const upload_path: string = uploaded.filepath
      temp_path = upload_path
      const max_bytes = await get_max_upload_bytes()
      const stat = await fs.promises.stat(upload_path)
      if (stat.size > max_bytes) {
        throw new AppError('PAYLOAD_TOO_LARGE', `上传文件超过上限 ${max_bytes} 字节`, 413)
      }
      const mime = typeof uploaded.mimetype === 'string' && uploaded.mimetype.length > 0
        ? uploaded.mimetype
        : 'application/octet-stream'
      const result = await blobs_service.putFile(upload_path, mime)
      temp_path = null
      json(ctx, 200, result)
    } catch (err) {
      if (temp_path !== null) {
        await fs.promises.unlink(temp_path).catch(() => undefined)
      }
      if ((err as { code?: string }).code === 'LIMIT_FILE_SIZE') {
        json(ctx, 413, { message: '上传文件过大', code: 'PAYLOAD_TOO_LARGE' })
      } else {
        if ((err as { name?: string }).name === 'AppError') {errorJson(ctx, err)}
        else {errorJson(ctx, storageError('upload failure', err))}
      }
    }
  })

  const readBlob = async (ctx: RouterContext) => {
    try {
      const parsed = zBlobID.parse(ctx.params.blob_id)
      const meta = await blobs_service.getMeta(parsed)
      if (meta === null) {throw notFound(`blob(${parsed}) not found`)}
      if (!(await blobs_service.exists(parsed))) {
        throw notFound(`blob(${parsed}) 文件不存在`)
      }
      const stat = await blobs_service.stat(parsed)
      const range = parseRange(ctx.request.headers.range, stat.size)

      ctx.set('Content-Type', meta.mime)
      ctx.set('ETag', `"${meta.id}"`)
      ctx.set('Cache-Control', 'public, max-age=31536000, immutable')
      ctx.set('Accept-Ranges', 'bytes')

      if (range === null) {
        ctx.status = 200
        ctx.set('Content-Length', String(stat.size))
        ctx.body = fs.createReadStream(blobs_service.pathFor(parsed))
      } else {
        ctx.status = 206
        ctx.set('Content-Range', `bytes ${range.start}-${range.end}/${stat.size}`)
        ctx.set('Content-Length', String(range.end - range.start + 1))
        ctx.body = fs.createReadStream(blobs_service.pathFor(parsed), {
          start: range.start,
          end: range.end,
        })
      }
    } catch (err) {
      errorJson(ctx, err)
    }
  }

  router.get('/blob/:blob_id', readBlob)
  router.head('/blob/:blob_id', readBlob)

  return router
}
