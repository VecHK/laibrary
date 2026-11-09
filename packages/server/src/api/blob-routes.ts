import fs from 'node:fs'
import path from 'node:path'
import Router, { type RouterContext } from '@koa/router'
import type { Context } from 'koa'
import { koaBody } from 'koa-body'
import { zBlobID } from '@laibrary/types'
import type { BootstrapConfig } from '../config/bootstrap'
import type { BlobService } from '../blob/service'
import { errorsIsAppError, errorsBadRequest, errorsNotFound, errorsPayloadTooLarge, errorsStorage } from '../errors'
import { directoryInitSync } from '../utils/directory'

function json(ctx: Context, status: number, body: unknown): void {
  ctx.status = status
  ctx.type = 'application/json'
  ctx.body = body
}

function errorJson(ctx: Context, err: unknown): void {
  if (errorsIsAppError(err)) {
    json(ctx, err.status, { message: err.message, code: err.code })
    return
  }
  const message = err instanceof Error ? err.message : String(err)
  json(ctx, 500, { message, code: 'INTERNAL' })
}

function detectSingleFile(ctx: Context) {
  const { files } = ctx.request
  if (files === undefined) {throw errorsBadRequest('upload failure: missing files')}
  if (Object.keys(files).length > 1) {
    throw errorsBadRequest("upload failure: only 'file' field is allowed")
  }
  const file = files['file']
  if (file === undefined) {throw errorsBadRequest("upload failure: require 'file' field")}
  if (Array.isArray(file)) {throw errorsBadRequest('upload failure: single upload required')}
  return file
}

type ParsedRange =
  | { readonly kind: 'none' }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'range'; readonly start: number; readonly end: number }

function parseRange(range: string | undefined, size: number): ParsedRange {
  if (range === undefined) {
    return { kind: 'none' }
  } else {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
    if (match === null) {
      return { kind: 'invalid' }
    } else {
      const start_raw = match[1] ?? ''
      const end_raw = match[2] ?? ''
      if (start_raw === '' && end_raw === '') {
        return { kind: 'invalid' }
      } else {
        const suffix = Number.parseInt(end_raw, 10)
        const start = (start_raw === '')
                      ? Math.max(0, size - suffix)
                      : Number.parseInt(start_raw, 10)
        const end = (start_raw === '' || end_raw === '')
                    ? size - 1
                    : Number.parseInt(end_raw, 10)
        if (
          !Number.isFinite(start) || !Number.isFinite(end) ||
          start > end || start >= size || (start_raw === '' && (!Number.isFinite(suffix) || suffix <= 0))
        ) {
          return { kind: 'invalid' }
        } else {
          return { kind: 'range', start, end: Math.min(end, size - 1) }
        }
      }
    }
  }
}

export type CreateBlobRouterOptions = {
  config: BootstrapConfig
  blobs: BlobService
  get_max_upload_bytes: () => Promise<number>
}

export function CreateBlobRouter({
  config,
  blobs,
  get_max_upload_bytes,
}: CreateBlobRouterOptions) {
  const router = new Router()
  directoryInitSync(config.upload_temp_path)
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
        throw errorsPayloadTooLarge(`上传文件超过上限 ${max_bytes} 字节`)
      }
      const mime = typeof uploaded.mimetype === 'string' && uploaded.mimetype.length > 0
        ? uploaded.mimetype
        : 'application/octet-stream'
      const result = await blobs.putFile(upload_path, mime)
      temp_path = null
      json(ctx, 200, result)
    } catch (err) {
      if (temp_path !== null) {
        await fs.promises.unlink(temp_path).catch(() => undefined)
      }
      if (err instanceof Error && 'code' in err && err.code === 'LIMIT_FILE_SIZE') {
        json(ctx, 413, { message: '上传文件过大', code: 'PAYLOAD_TOO_LARGE' })
      } else {
        if (errorsIsAppError(err)) {errorJson(ctx, err)}
        else {errorJson(ctx, errorsStorage('upload failure', err))}
      }
    }
  })

  const readBlob = async (ctx: RouterContext) => {
    try {
      const parsed = zBlobID.parse(ctx.params.blob_id)
      const meta = await blobs.getMeta(parsed)
      if (meta === null) {throw errorsNotFound(`blob(${parsed}) not found`)}
      if (!(await blobs.exists(parsed))) {
        throw errorsNotFound(`blob(${parsed}) 文件不存在`)
      }
      const stat = await blobs.stat(parsed)
      const range = parseRange(ctx.request.headers.range, stat.size)

      ctx.set('Content-Type', meta.mime)
      ctx.set('ETag', `"${meta.id}"`)
      ctx.set('Cache-Control', 'public, max-age=31536000, immutable')
      ctx.set('Accept-Ranges', 'bytes')

      if (range.kind !== 'range') {
        ctx.status = 200
        ctx.set('Content-Length', String(stat.size))
        ctx.body = fs.createReadStream(blobs.pathFor(parsed))
      } else {
        ctx.status = 206
        ctx.set('Content-Range', `bytes ${range.start}-${range.end}/${stat.size}`)
        ctx.set('Content-Length', String(range.end - range.start + 1))
        ctx.body = fs.createReadStream(blobs.pathFor(parsed), {
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
