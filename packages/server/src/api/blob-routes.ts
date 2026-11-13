import fs from 'node:fs'
import path from 'node:path'
import { Readable } from 'node:stream'
import type { HttpBindings } from '@hono/node-server'
import { Hono, type Context } from 'hono'
import formidable from 'formidable'
import type { File as FormidableFile, Files } from 'formidable'
import { zBlobID } from '@laibrary/types'
import type { BootstrapConfig } from '../config/bootstrap'
import type { BlobService } from '../blob/service'
import { errorsIsAppError, errorsBadRequest, errorsNotFound, errorsPayloadTooLarge, errorsStorage } from '../errors'
import { directoryInitSync } from '../utils/directory'

const UPLOAD_HARD_LIMIT_BYTES = 1024 * 1024 * 1024

function detectSingleFile(files: Files): FormidableFile {
  // formidable v3 的 Files 值恒为数组
  const list = files['file'] ?? []
  const file = list[0]
  if (file === undefined) {
    throw errorsBadRequest("upload failure: require 'file' field")
  } else if (list.length > 1) {
    throw errorsBadRequest('upload failure: single upload required')
  } else {
    return file
  }
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

function httpCodeOf(err: unknown): number | null {
  if (typeof err === 'object' && err !== null && 'httpCode' in err && typeof err.httpCode === 'number') {
    return err.httpCode
  } else {
    return null
  }
}

function errorMessageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function baseBlobHeaders(mime: string, blob_id: string): Record<string, string> {
  return {
    'Content-Type': mime,
    'ETag': `"${blob_id}"`,
    'Cache-Control': 'public, max-age=31536000, immutable',
    'Accept-Ranges': 'bytes',
  }
}

function streamResponse(
  file_path: string,
  status: number,
  headers: Record<string, string>,
  range: { start: number, end: number } | null,
): Response {
  const node_stream = range === null
                      ? fs.createReadStream(file_path)
                      : fs.createReadStream(file_path, { start: range.start, end: range.end })
  return new Response(Readable.toWeb(node_stream), { status, headers })
}

export type CreateBlobRouterOptions = {
  config: BootstrapConfig
  blobs: BlobService
  get_max_upload_bytes: () => Promise<number>
}

export function CreateBlobRouter({
  config: _config,
  blobs: _blobs,
  get_max_upload_bytes: _get_max_upload_bytes,
}: CreateBlobRouterOptions) {
  const app = new Hono<{ Bindings: HttpBindings }>()
  directoryInitSync(_config.upload_temp_path)
  for (const temp_file of fs.readdirSync(_config.upload_temp_path)) {
    try {
      fs.unlinkSync(path.join(_config.upload_temp_path, temp_file))
    } catch (err) {
      console.error('清理上传临时文件失败', err)
    }
  }

  app.post('/blob', async c => {
    let $temp_path: string | null = null
    try {
      const max_bytes = await _get_max_upload_bytes()
      const form = formidable({
        // 解析前就按 runtime 上限拒绝，避免把超限文件完整写进临时目录
        maxFileSize: Math.min(UPLOAD_HARD_LIMIT_BYTES, max_bytes),
        maxFiles: 1,
        maxFields: 1,
        allowEmptyFiles: false,
        keepExtensions: true,
        uploadDir: _config.upload_temp_path,
        filter: part => part.name === 'file',
      })
      const [, files] = await form.parse(c.env.incoming)
      const uploaded = detectSingleFile(files)
      const upload_path: string = uploaded.filepath
      $temp_path = upload_path
      const stat = await fs.promises.stat(upload_path)
      if (stat.size > max_bytes) {
        throw errorsPayloadTooLarge(`上传文件超过上限 ${max_bytes} 字节`)
      }
      const mime = typeof uploaded.mimetype === 'string' && uploaded.mimetype.length > 0
                   ? uploaded.mimetype
                   : 'application/octet-stream'
      const result = await _blobs.putFile(upload_path, mime)
      $temp_path = null
      return c.json(result, 200)
    } catch (err) {
      if ($temp_path !== null) {
        await fs.promises.unlink($temp_path).catch(() => undefined)
      }
      if (errorsIsAppError(err)) {
        throw err
      } else {
        const http_code = httpCodeOf(err)
        if (http_code === 413) {
          throw errorsPayloadTooLarge('上传文件过大')
        } else if (http_code !== null && http_code >= 400 && http_code < 500) {
          throw errorsBadRequest(`upload failure: ${errorMessageOf(err)}`)
        } else {
          throw errorsStorage('upload failure', err)
        }
      }
    }
  })

  const readBlob = async (c: Context<{ Bindings: HttpBindings }>) => {
    const parsed = zBlobID.parse(c.req.param('blob_id'))
    const meta = await _blobs.getMeta(parsed)
    if (meta === null) {
      throw errorsNotFound(`blob(${parsed}) not found`)
    } else if (!(await _blobs.exists(parsed))) {
      throw errorsNotFound(`blob(${parsed}) 文件不存在`)
    } else {
      const stat = await _blobs.stat(parsed)
      const range = parseRange(c.req.header('range'), stat.size)
      const base_headers = baseBlobHeaders(meta.mime, meta.id)

      if (c.req.method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: { ...base_headers, 'Content-Length': String(stat.size) },
        })
      } else if (range.kind !== 'range') {
        return streamResponse(
          _blobs.pathFor(parsed),
          200,
          { ...base_headers, 'Content-Length': String(stat.size) },
          null,
        )
      } else {
        return streamResponse(
          _blobs.pathFor(parsed),
          206,
          {
            ...base_headers,
            'Content-Range': `bytes ${range.start}-${range.end}/${stat.size}`,
            'Content-Length': String(range.end - range.start + 1),
          },
          range,
        )
      }
    }
  }

  // Hono 会把 HEAD 请求按 GET 派发并自动去掉 body
  app.get('/blob/:blob_id', readBlob)

  return app
}
