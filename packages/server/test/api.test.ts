import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { serve } from '@hono/node-server'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { BlobMeta, ConfigSnapshot, Item } from '@laibrary/types'
import {
  closeDb, prepareTestBlobs, prepareTestDb, testPng, truncateAll,
} from './helpers'
import type { DB } from '../src/db/client'
import type { BlobService } from '../src/blob/service'
import { CreateConfigStore, type ConfigStore } from '../src/config/store'
import { CreateApi } from '../src/api'
import type { BootstrapConfig } from '../src/config/bootstrap'
import type { ThumbnailService } from '../src/thumbnails/service'
import { CreateThumbnailService } from '../src/thumbnails/service'

let db: DB
let blobs: BlobService
let config_service: ConfigStore
let thumbnails: ThumbnailService
let app: Awaited<ReturnType<typeof CreateApi>>
let tmp_dir: string
let cleanup_blobs: () => Promise<void>
let server: ReturnType<typeof serve>
let base_url = ''

type ApiResult<T> = {
  readonly status: number
  readonly body: T
  readonly headers: Headers
}

type ErrorBody = { message: string, code: string }
type UploadBody = { blob: BlobMeta, reused: boolean }

async function readJson<T>(res: Response): Promise<T> {
  return await res.json() as T
}

async function action<T = unknown>(name: string, payload: unknown): Promise<ApiResult<T>> {
  const res = await app.request('/action', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: name, payload }),
  })
  return { status: res.status, body: await readJson<T>(res), headers: res.headers }
}

async function upload(filename: string): Promise<ApiResult<UploadBody>> {
  const form_data = new FormData()
  form_data.append('file', new File([testPng()], filename, { type: 'image/png' }))
  const res = await fetch(`${base_url}/blob`, { method: 'POST', body: form_data })
  return { status: res.status, body: await readJson<UploadBody>(res), headers: res.headers }
}

beforeAll(async () => {
  db = await prepareTestDb()
  const prepared = await prepareTestBlobs(db)
  blobs = prepared.blobs
  cleanup_blobs = prepared.cleanup
  config_service = CreateConfigStore({ db, on_error: error => console.error('test config', error) })
  await config_service.ensure()
  await config_service.reload()
  thumbnails = CreateThumbnailService({ db, blobs })

  tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'laibrary-api-'))
  const config: BootstrapConfig = {
    database_url: 'unused',
    http_api_port: 0,
    host: '127.0.0.1',
    storage_path: tmp_dir,
    blob_path: path.join(tmp_dir, 'blobs'),
    upload_temp_path: path.join(tmp_dir, 'uploadtemp'),
    log_level: 'error',
    migrate_on_start: false,
  }
  app = await CreateApi({ config, db, blobs, config_store: config_service, thumbnails })

  // 上传依赖 Node 适配器的 c.env.incoming，用真实 server 覆盖该路径
  await new Promise<void>(resolve => {
    server = serve({ fetch: app.fetch, port: 0, hostname: '127.0.0.1' }, info => {
      base_url = `http://127.0.0.1:${info.port}`
      resolve()
    })
  })
})

beforeEach(async () => {
  await truncateAll(db)
  await config_service.ensure()
  await config_service.reload()
})

afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close(err => (err === undefined ? resolve() : reject(err)))
  })
  await cleanup_blobs()
  await fs.rm(tmp_dir, { recursive: true, force: true })
  await closeDb(db)
})

describe('RPC API', () => {
  it('addItem / listing / getItemByUnityName', async () => {
    const added = await action<Item>('addItem', {
      role: 'page',
      title: '端到端',
      unity_name: 'page.e2e',
    })
    expect(added.status).toBe(200)
    expect(added.body.id).toBeGreaterThan(0)
    expect(added.body.role).toBe('page')

    const listed = await action<readonly Item[]>('listing', {
      limit: 10,
      filter_rules: [{ name: 'title', input: '端到端', logic: 'and' }],
    })
    expect(listed.status).toBe(200)
    expect(listed.body).toHaveLength(1)

    const by_name = await action<Item>('getItemByUnityName', { unity_name: 'page.e2e' })
    expect(by_name.body.id).toBe(added.body.id)

    const by_name_missing = await action<Item | null>('getItemByUnityName', { unity_name: 'page.none' })
    expect(by_name_missing.body).toBeNull()
  })

  it('unknown action / payload validation / entity kind', async () => {
    const unknown = await action<ErrorBody>('no_such_action', {})
    expect(unknown.status).toBe(400)

    const bad = await action<ErrorBody>('addItem', { role: 'page', kind: 'manga' })
    expect(bad.status).toBe(400)
    expect(bad.body.code).toBe('VALIDATION')

    const entity_bad = await action('addItem', { role: 'entity', title: 'bad' })
    expect(entity_bad.status).toBe(400)

    const entity = await action<Item>('addItem', { role: 'entity', kind: 'manga', title: 'manga' })
    expect(entity.status).toBe(200)
    expect(entity.body.kind).toBe('manga')
  })

  it('malformed JSON 与错误方法', async () => {
    const malformed = await app.request('/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    })
    expect(malformed.status).toBe(400)
    expect((await readJson<ErrorBody>(malformed)).code).toBe('BAD_REQUEST')

    const wrong_method = await app.request('/action')
    expect(wrong_method.status).toBe(405)
    expect(wrong_method.headers.get('allow')).toContain('POST')

    const too_large = await app.request('/action', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'noop', payload: 'x'.repeat(5 * 1024 * 1024) }),
    })
    expect(too_large.status).toBe(413)
    expect((await readJson<ErrorBody>(too_large)).code).toBe('PAYLOAD_TOO_LARGE')

    const with_origin = await app.request('/action', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Origin: 'http://example.test',
      },
      body: JSON.stringify({ action: 'no_such_action', payload: {} }),
    })
    expect(with_origin.headers.get('access-control-allow-origin')).not.toBeNull()

    const blob_wrong_method = await app.request(`/blob/${'a'.repeat(64)}`, { method: 'PUT' })
    expect(blob_wrong_method.status).toBe(405)
  })

  it('config get/update', async () => {
    const before = await action<ConfigSnapshot>('getConfig', undefined)
    expect(before.status).toBe(200)
    expect(before.body.version).toBe(1)

    const updated = await action('updateConfig', {
      key: 'sys.config.manga_default_direction',
      value: 'ltr',
    })
    expect(updated.status).toBe(200)

    const after = await action<ConfigSnapshot>('getConfig', undefined)
    const snapshot: ConfigSnapshot = after.body
    expect(snapshot.entries.find(e => e.key === 'sys.config.manga_default_direction')?.value)
      .toBe('ltr')

    const bad_type = await action('updateConfig', {
      key: 'sys.config.gc_grace_hours',
      value: 'nope',
    })
    expect(bad_type.status).toBe(400)
  })

  it('blob upload / dedup / read / range / head / image / thumbnail', async () => {
    const upload1 = await upload('pixel.png')
    expect(upload1.status).toBe(200)
    expect(upload1.body.blob.mime).toBe('image/png')
    expect(upload1.body.blob.width).toBe(1)

    const upload2 = await upload('other.png')
    expect(upload2.status).toBe(200)
    expect(upload2.body.blob.id).toBe(upload1.body.blob.id)
    expect(upload2.body.reused).toBe(true)

    const blob_id = upload1.body.blob.id
    const read = await app.request(`/blob/${blob_id}`)
    expect(read.status).toBe(200)
    expect(read.headers.get('content-type')).toContain('image/png')
    expect(read.headers.get('etag')).toBe(`"${blob_id}"`)

    const range = await app.request(`/blob/${blob_id}`, {
      headers: { Range: 'bytes=0-3' },
    })
    expect(range.status).toBe(206)
    expect(range.headers.get('content-range')).toBe(`bytes 0-3/${upload1.body.blob.size}`)
    expect((await range.arrayBuffer()).byteLength).toBe(4)

    const head = await app.request(`/blob/${blob_id}`, { method: 'HEAD' })
    expect(head.status).toBe(200)
    expect(head.headers.get('content-length')).toBe(String(upload1.body.blob.size))

    const image = await action<Item>('addItem', {
      role: 'image',
      title: 'pixel',
      blob_id,
      attributes: { filename: 'pixel.png' },
    })
    expect(image.status).toBe(200)
    expect(image.body.blob?.id).toBe(blob_id)

    const thumb = await app.request(`/thumb/${image.body.id}?size=384`)
    expect(thumb.status).toBe(200)
    expect(thumb.headers.get('content-type')).toContain('image/avif')

    const bad_thumb = await app.request(`/thumb/${image.body.id}?size=123`)
    expect(bad_thumb.status).toBe(400)
  })

  it('blob upload 缺少文件时为 400', async () => {
    const missing = await fetch(`${base_url}/blob`, { method: 'POST', body: new FormData() })
    expect(missing.status).toBe(400)
    expect((await readJson<ErrorBody>(missing)).code).toBe('BAD_REQUEST')
  })

  it('坏 multipart 与非法 blob id 都是 4xx', async () => {
    const malformed = await fetch(`${base_url}/blob`, {
      method: 'POST',
      headers: { 'content-type': 'multipart/form-data' },
      body: 'not-a-multipart-body',
    })
    expect(malformed.status).toBe(400)
    expect((await readJson<ErrorBody>(malformed)).code).toBe('BAD_REQUEST')

    const bad_id = await app.request('/blob/not-a-blob-id')
    expect(bad_id.status).toBe(400)
    expect((await readJson<ErrorBody>(bad_id)).code).toBe('VALIDATION')
  })

  it('上传超过 runtime 上限时为 413', async () => {
    const updated = await action('updateConfig', {
      key: 'sys.config.upload_max_bytes',
      value: 10,
    })
    expect(updated.status).toBe(200)

    const form_data = new FormData()
    form_data.append('file', new File([testPng()], 'too-big.png', { type: 'image/png' }))
    const res = await fetch(`${base_url}/blob`, { method: 'POST', body: form_data })
    expect(res.status).toBe(413)
    expect((await readJson<ErrorBody>(res)).code).toBe('PAYLOAD_TOO_LARGE')
  })

  it('itemlink target 校验', async () => {
    const page = await action<Item>('addItem', { role: 'page', title: 'target' })
    const link = await action<Item>('addItem', {
      role: 'itemlink',
      title: 'link',
      target_id: page.body.id,
    })
    expect(link.status).toBe(200)
    expect(link.body.target_id).toBe(page.body.id)

    const bad = await action('addItem', {
      role: 'itemlink',
      title: 'bad',
      target_id: 999999,
    })
    expect(bad.status).toBe(404)
  })

  it('系统项不能通过通用接口修改', async () => {
    const config_item = await action<Item>('getItemByUnityName', { unity_name: 'sys.config' })
    const updated = await action('updateItem', {
      id: config_item.body.id,
      data: { title: 'hack' },
    })
    expect(updated.status).toBe(400)
  })
})
