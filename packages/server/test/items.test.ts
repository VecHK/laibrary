import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  closeDb, prepareTestBlobs, prepareTestDb, testPng, truncateAll,
} from './helpers'
import type { DB } from '../src/db/client'
import type { BlobService } from '../src/blob/service'
import {
  createItem, deleteItem, getItem, getItemByUnityName, getItems,
  updateItem,
} from '../src/repo/items'

let db: DB
let blobs: BlobService
let cleanup: () => Promise<void>

beforeAll(async () => {
  db = await prepareTestDb()
  const prepared = await prepareTestBlobs(db)
  blobs = prepared.blobs
  cleanup = prepared.cleanup
})

beforeEach(async () => {
  await truncateAll(db)
})

afterAll(async () => {
  await cleanup()
  await closeDb(db)
})

async function page(title: string, extra: Record<string, unknown> = {}) {
  return createItem(db, { role: 'page', title, ...extra }, blobs)
}

describe('role / kind', () => {
  it('page 无 kind，entity 必须有 kind', async () => {
    const p = await page('p')
    expect(p.role).toBe('page')
    expect(p.kind).toBeNull()

    const manga = await createItem(db, {
      role: 'entity', kind: 'manga', title: '漫画',
    }, blobs)
    expect(manga.kind).toBe('manga')

    await expect(createItem(db, { role: 'entity', title: 'bad' }, blobs))
      .rejects.toThrow('kind')
    await expect(createItem(db, { role: 'page', kind: 'manga', title: 'bad' }, blobs))
      .rejects.toThrow('kind')
  })

  it('默认 role 是 page，直接构造时仍然显式要求', async () => {
    const item = await createItem(db, { role: 'page' }, blobs)
    expect(item.role).toBe('page')
  })
})

describe('blob roles', () => {
  it('file/image 必须引用 blob，image 必须是图片', async () => {
    const image_blob = await blobs.putBuffer(testPng(), 'image/png')
    const file_blob = await blobs.putBuffer(Buffer.from('pdf'), 'application/pdf')

    const image = await createItem(db, {
      role: 'image',
      title: 'pixel',
      blob_id: image_blob.blob.id,
      attributes: { filename: 'pixel.png' },
    }, blobs)
    expect(image.blob?.mime).toBe('image/png')
    expect(image.blob?.width).toBe(1)

    const file = await createItem(db, {
      role: 'file',
      title: 'doc',
      blob_id: file_blob.blob.id,
      attributes: { filename: 'a.pdf' },
    }, blobs)
    expect(file.blob?.mime).toBe('application/pdf')

    await expect(createItem(db, {
      role: 'image',
      title: 'bad',
      blob_id: file_blob.blob.id,
      attributes: { filename: 'a.pdf' },
    }, blobs)).rejects.toThrow('不是有效图片')

    await expect(createItem(db, {
      role: 'image',
      title: 'missing',
      attributes: { filename: 'x.png' },
    }, blobs)).rejects.toThrow('blob_id')

    await expect(createItem(db, {
      role: 'page',
      title: 'bad page',
      blob_id: file_blob.blob.id,
    }, blobs)).rejects.toThrow('blob_id')
  })
})

describe('unity_name', () => {
  it('全局唯一、可按名查找、系统前缀禁止', async () => {
    const item = await page('named', { unity_name: 'page.home' })
    expect(item.unity_name).toBe('page.home')

    const found = await getItemByUnityName(db, 'page.home')
    expect(found?.id).toBe(item.id)

    await expect(page('other', { unity_name: 'page.home' })).rejects.toThrow('重复')
    await expect(page('sys', { unity_name: 'sys.fake' })).rejects.toThrow('系统保留前缀')
    expect(await getItemByUnityName(db, 'page.none')).toBeNull()
  })
})

describe('itemlink', () => {
  it('target 存在且可更新，拒绝自指和缺失', async () => {
    const a = await page('a')
    const b = await page('b')
    const link = await createItem(db, {
      role: 'itemlink', title: 'link', target_id: a.id,
    }, blobs)
    expect(link.target_id).toBe(a.id)

    const updated = await updateItem(db, link.id, { target_id: b.id }, blobs)
    expect(updated.target_id).toBe(b.id)

    await expect(updateItem(db, link.id, { target_id: link.id }, blobs))
      .rejects.toThrow('不能指向自己')
    await expect(createItem(db, {
      role: 'itemlink', title: 'missing', target_id: 999999,
    }, blobs)).rejects.toThrow('not found')
  })
})

describe('inline item token', () => {
  it('textline 写入时校验目标，更新时拒绝自指', async () => {
    const target = await page('target')
    const line = await createItem(db, {
      role: 'textline',
      title: `hello [[item:${target.id}]]`,
      parent_id: target.id,
    }, blobs)
    expect(line.title).toContain('[[item:')

    await expect(createItem(db, {
      role: 'textline', title: 'bad [[item:999999]]',
    }, blobs)).rejects.toThrow('not found')

    await expect(updateItem(db, line.id, {
      title: `self [[item:${line.id}]]`,
    }, blobs)).rejects.toThrow('不能指向自己')
  })
})

describe('tree / tags / database', () => {
  it('子项顺序、环检测、删除保护', async () => {
    const parent = await page('parent')
    const a = await createItem(db, { role: 'page', parent_id: parent.id }, blobs)
    const b = await createItem(db, { role: 'page', parent_id: parent.id }, blobs)
    expect(a.order_index).toBe(1)
    expect(b.order_index).toBe(2)

    await expect(updateItem(db, parent.id, { parent_id: b.id }, blobs))
      .rejects.toThrow('后代')
    await expect(deleteItem(db, parent.id)).rejects.toThrow('子项')
    await expect(createItem(db, {
      role: 'page', parent_id: (await createItem(db, { role: 'textline' }, blobs)).id,
    }, blobs)).rejects.toThrow('不允许有子项')
  })

  it('tags 必须是 tag item，删除 tag 会清扫', async () => {
    const tag = await createItem(db, { role: 'tag', title: 'tag' }, blobs)
    const item = await page('tagged', { tags: [tag.id, tag.id] })
    expect(item.tags).toEqual([tag.id])

    await expect(page('bad tag', { tags: [999999] })).rejects.toThrow('tag 不存在')

    await deleteItem(db, tag.id)
    expect((await getItem(db, item.id)).tags).toEqual([])
  })

  it('database schema 与 unity_name 字段', async () => {
    const database = await createItem(db, {
      role: 'database',
      title: 'db',
      attributes: {
        schema: [
          { name: 'unity_name', type: 'unity_name' },
          { name: 'year', type: 'number' },
        ],
      },
    }, blobs)

    const row = await createItem(db, {
      role: 'page',
      parent_id: database.id,
      unity_name: 'game.mario',
      attributes: { year: 1985 },
    }, blobs)
    expect(row.unity_name).toBe('game.mario')
    expect(row.attributes['year']).toBe(1985)

    await expect(createItem(db, {
      role: 'page', parent_id: database.id, attributes: { year: 1 },
    }, blobs)).rejects.toThrow('unity_name')
    await expect(createItem(db, {
      role: 'page', parent_id: database.id, unity_name: 'game.mario', attributes: { year: 2 },
    }, blobs)).rejects.toThrow('重复')
  })

  it('getItems 按输入顺序返回', async () => {
    const a = await page('a')
    const b = await page('b')
    const items = await getItems(db, [b.id, a.id])
    expect(items.map(item => item.title)).toEqual(['b', 'a'])
  })
})
