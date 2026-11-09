import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  closeDb, prepareTestBlobs, prepareTestDb, testPng, truncateAll,
} from './helpers'
import type { DB } from '../src/db/client'
import type { BlobService } from '../src/blob/service'
import { ConfigService } from '../src/config/runtime'
import { createApi } from '../src/api'
import type { BootstrapConfig } from '../src/config/bootstrap'
import type { ConfigSnapshot } from '@laibrary/types'
import type { ThumbnailService } from '../src/thumbnails/service'
import { ThumbnailService as Thumbnails } from '../src/thumbnails/service'

let db: DB
let blobs: BlobService
let config_service: ConfigService
let thumbnails: ThumbnailService
let app: Awaited<ReturnType<typeof createApi>>
let tmp_dir: string
let cleanup_blobs: () => Promise<void>

beforeAll(async () => {
  db = await prepareTestDb()
  const prepared = await prepareTestBlobs(db)
  blobs = prepared.blobs
  cleanup_blobs = prepared.cleanup
  config_service = new ConfigService(db)
  await config_service.ensure()
  await config_service.load(true)
  thumbnails = new Thumbnails(db, blobs)

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
  app = await createApi(config, db, blobs, config_service, thumbnails)
})

beforeEach(async () => {
  await truncateAll(db)
  await config_service.ensure()
  await config_service.load(true)
})

afterAll(async () => {
  await cleanup_blobs()
  await fs.rm(tmp_dir, { recursive: true, force: true })
  await closeDb(db)
})

function action(name: string, payload: unknown) {
  return request(app.callback())
    .post('/action')
    .send({ action: name, payload })
}

describe('RPC API', () => {
  it('addItem / listing / getItemByUnityName', async () => {
    const added = await action('addItem', {
      role: 'page',
      title: '端到端',
      unity_name: 'page.e2e',
    })
    expect(added.status).toBe(200)
    expect(added.body.id).toBeGreaterThan(0)
    expect(added.body.role).toBe('page')

    const listed = await action('listing', {
      limit: 10,
      filter_rules: [{ name: 'title', input: '端到端', logic: 'and' }],
    })
    expect(listed.status).toBe(200)
    expect(listed.body).toHaveLength(1)

    const by_name = await action('getItemByUnityName', { unity_name: 'page.e2e' })
    expect(by_name.body.id).toBe(added.body.id)

    const by_name_missing = await action('getItemByUnityName', { unity_name: 'page.none' })
    expect(by_name_missing.body).toBeNull()
  })

  it('unknown action / payload validation / entity kind', async () => {
    const unknown = await action('no_such_action', {})
    expect(unknown.status).toBe(400)

    const bad = await action('addItem', { role: 'page', kind: 'manga' })
    expect(bad.status).toBe(400)
    expect(bad.body.code).toBe('VALIDATION')

    const entity_bad = await action('addItem', { role: 'entity', title: 'bad' })
    expect(entity_bad.status).toBe(400)

    const entity = await action('addItem', { role: 'entity', kind: 'manga', title: 'manga' })
    expect(entity.status).toBe(200)
    expect(entity.body.kind).toBe('manga')
  })

  it('config get/update', async () => {
    const before = await action('getConfig', undefined)
    expect(before.status).toBe(200)
    expect(before.body.version).toBe(1)

    const updated = await action('updateConfig', {
      key: 'sys.config.manga_default_direction',
      value: 'ltr',
    })
    expect(updated.status).toBe(200)

    const after = await action('getConfig', undefined)
    const snapshot: ConfigSnapshot = after.body
    expect(snapshot.entries.find(e => e.key === 'sys.config.manga_default_direction')?.value)
      .toBe('ltr')

    const bad_type = await action('updateConfig', {
      key: 'sys.config.gc_grace_hours',
      value: 'nope',
    })
    expect(bad_type.status).toBe(400)
  })

  it('blob upload / dedup / read / image / thumbnail', async () => {
    const upload1 = await request(app.callback())
      .post('/blob')
      .attach('file', testPng(), 'pixel.png')
    expect(upload1.status).toBe(200)
    expect(upload1.body.blob.mime).toBe('image/png')
    expect(upload1.body.blob.width).toBe(1)

    const upload2 = await request(app.callback())
      .post('/blob')
      .attach('file', testPng(), 'other.png')
    expect(upload2.status).toBe(200)
    expect(upload2.body.blob.id).toBe(upload1.body.blob.id)
    expect(upload2.body.reused).toBe(true)

    const blob_id = upload1.body.blob.id
    const read = await request(app.callback()).get(`/blob/${blob_id}`)
    expect(read.status).toBe(200)
    expect(read.headers['content-type']).toContain('image/png')
    expect(read.headers.etag).toBe(`"${blob_id}"`)

    const image = await action('addItem', {
      role: 'image',
      title: 'pixel',
      blob_id,
      attributes: { filename: 'pixel.png' },
    })
    expect(image.status).toBe(200)
    expect(image.body.blob.id).toBe(blob_id)

    const thumb = await request(app.callback())
      .get(`/thumb/${image.body.id}?size=384`)
    expect(thumb.status).toBe(200)
    expect(thumb.headers['content-type']).toContain('image/avif')

    const bad_thumb = await request(app.callback())
      .get(`/thumb/${image.body.id}?size=123`)
    expect(bad_thumb.status).toBe(400)
  })

  it('itemlink target 校验', async () => {
    const page = await action('addItem', { role: 'page', title: 'target' })
    const link = await action('addItem', {
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
    const config_item = await action('getItemByUnityName', { unity_name: 'sys.config' })
    const updated = await action('updateItem', {
      id: config_item.body.id,
      data: { title: 'hack' },
    })
    expect(updated.status).toBe(400)
  })
})
