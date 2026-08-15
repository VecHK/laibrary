import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import request from 'supertest'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { closeDb, prepareTestDb, truncateItems } from './helpers'
import { initFilePool } from '../src/blob/file-pool'
import { createApi } from '../src/api'
import type { Config } from '../src/config'
import type { DB } from '../src/db/client'

let db: DB
let tmp_dir: string
let app: ReturnType<typeof createApi>

beforeAll(async () => {
  db = await prepareTestDb()
  tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'laibrary-api-'))

  const blob = await initFilePool(path.join(tmp_dir, 'files'))
  const config: Config = {
    database_url: 'unused',
    http_api_port: 0,
    storage_path: tmp_dir,
    filepool_path: path.join(tmp_dir, 'files'),
    upload_temp_path: path.join(tmp_dir, 'uploadtemp'),
  }
  app = createApi(config, db, blob)
})

beforeEach(async () => {
  await truncateItems(db)
})

afterAll(async () => {
  await closeDb(db)
  await fs.rm(tmp_dir, { recursive: true, force: true })
})

function action(action: string, payload: unknown) {
  return request(app.callback())
    .post('/action')
    .send({ action, payload })
}

describe('RPC API', () => {
  it('addItem → listing 端到端', async () => {
    const res_add = await action('addItem', {
      role: 'custom',
      title: '端到端',
      attributes: { release_date: '2020-01-01' },
    })
    expect(res_add.status).toBe(200)
    expect(res_add.body.id).toBeGreaterThan(0)
    expect(res_add.body.role).toBe('custom')

    const res_list = await action('listing', {
      limit: 10,
      filter_rules: [{ name: 'title', input: '端到端', logic: 'and' }],
    })
    expect(res_list.status).toBe(200)
    expect(res_list.body.length).toBe(1)
    expect(res_list.body[0].title).toBe('端到端')
    expect(res_list.body[0].create_date).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('newTag get-or-create', async () => {
    const res1 = await action('newTag', { title: 'RPC标签' })
    const res2 = await action('newTag', { title: 'rpc标签' })
    expect(res1.body.id).toBe(res2.body.id)

    const res3 = await action('searchTag', { name: 'RPC' })
    expect(res3.body.length).toBe(1)
  })

  it('未知 action 返回 400', async () => {
    const res = await action('no_such_action', {})
    expect(res.status).toBe(400)
  })

  it('校验错误返回 400', async () => {
    const res = await action('addItem', {
      role: 'file',
      attributes: {},
    })
    expect(res.status).toBe(400)
    expect(res.body.message).toBeTruthy()
  })

  it('引用不存在的 FileID 返回 500', async () => {
    const res = await action('addItem', {
      role: 'custom',
      attributes: { cover: 'fid_99999.png' },
    })
    expect(res.status).toBe(500)
    expect(res.body.message).toContain('不存在')
  })

  it('generateThumb 生成缩略图并更新 image item', async () => {
    const res_upload = await request(app.callback())
      .post('/file')
      .attach('file', Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        'base64',
      ), 'pixel.png')
    expect(res_upload.status).toBe(200)
    const file_id: string = res_upload.body
    expect(file_id).toMatch(/^fid_\d+\.png$/)

    const res_item = await action('addItem', {
      role: 'image',
      title: '像素图',
      attributes: {
        src: file_id,
        filename: 'pixel.png',
        mime: 'image/png',
        size: 68,
        image_width: 1,
        image_height: 1,
      },
    })
    const item_id: number = res_item.body.id

    const res_thumb = await action('generateThumb', { id: item_id })
    expect(res_thumb.status).toBe(200)
    expect(res_thumb.body.file_id).toMatch(/^fid_\d+\.avif$/)

    const res_get = await action('getItem', { id: item_id })
    expect(res_get.body.attributes.cover_src).toBe(res_thumb.body.file_id)

    const res_file = await request(app.callback())
      .get(`/readfile/${res_thumb.body.file_id}`)
    expect(res_file.status).toBe(200)
  })

  it('database 行写入校验', async () => {
    const res_db = await action('addItem', {
      role: 'database',
      title: 'API库',
      attributes: {
        schema: [{ name: 'year', type: 'number' }],
      },
    })
    const database_id: number = res_db.body.id

    const res_row = await action('addItem', {
      role: 'custom',
      parent_id: database_id,
      attributes: { year: 2024 },
    })
    expect(res_row.status).toBe(200)

    const res_bad = await action('addItem', {
      role: 'custom',
      parent_id: database_id,
      attributes: { year: '不是数字' },
    })
    expect(res_bad.status).toBe(400)
  })

  it('listing 按字段排序', async () => {
    await action('addItem', { role: 'custom', title: 'c', attributes: { score: 3 } })
    await action('addItem', { role: 'custom', title: 'a', attributes: { score: 1 } })
    await action('addItem', { role: 'custom', title: 'b', attributes: { score: 2 } })

    const res = await action('listing', {
      limit: 0,
      sort_field: { name: 'score', type: 'number' },
    })
    expect(res.body.map((i: { title: string }) => i.title)).toEqual(['a', 'b', 'c'])
  })
})
