import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  closeDb, prepareTestBlobs, prepareTestDb, testPng, truncateAll,
} from './helpers'
import type { DB } from '../src/db/client'
import type { BlobService } from '../src/blob/service'
import {
  convertTextBlock, createItem, deleteItem, getItem, getItemByUnityName, getItems,
  updateItem,
} from '../src/repo/items'
import { unwrapWrite, type WriteResult } from '../src/write-result'

let $_db: DB
let $_blobs: BlobService
let $_cleanup: () => Promise<void>

beforeAll(async () => {
  $_db = await prepareTestDb()
  const prepared = await prepareTestBlobs($_db)
  $_blobs = prepared.blobs
  $_cleanup = prepared.cleanup
})

beforeEach(async () => {
  await truncateAll($_db)
})

afterAll(async () => {
  await $_cleanup()
  await closeDb($_db)
})

async function expectWriteFailure(
  write: Promise<WriteResult<unknown>>,
  message: string,
): Promise<void> {
  const result = await write
  if (result.ok) {
    expect.fail('expected write failure')
  } else {
    expect(result.error.message).toContain(message)
  }
}

async function page(title: string, extra: Record<string, unknown> = {}) {
  return unwrapWrite(await createItem($_db, { role: 'page', title, ...extra }, $_blobs))
}

describe('role / kind', () => {
  it('page 无 kind，entity 必须有 kind', async () => {
    const p = await page('p')
    expect(p.role).toBe('page')
    expect(p.kind).toBeNull()

    const manga = unwrapWrite(await createItem($_db, {
      role: 'entity', kind: 'manga', title: '漫画',
    }, $_blobs))
    expect(manga.kind).toBe('manga')

    await expectWriteFailure(createItem($_db, { role: 'entity', title: 'bad' }, $_blobs), 'kind')
    await expectWriteFailure(createItem($_db, { role: 'page', kind: 'manga', title: 'bad' }, $_blobs), 'kind')
  })

  it('默认 role 是 page，直接构造时仍然显式要求', async () => {
    const item = unwrapWrite(await createItem($_db, { role: 'page' }, $_blobs))
    expect(item.role).toBe('page')
  })
})

describe('blob roles', () => {
  it('file/image 必须引用 blob，image 必须是图片', async () => {
    const image_blob = unwrapWrite(await $_blobs.putBuffer(testPng(), 'image/png'))
    const file_blob = unwrapWrite(await $_blobs.putBuffer(Buffer.from('pdf'), 'application/pdf'))

    const image = unwrapWrite(await createItem($_db, {
      role: 'image',
      title: 'pixel',
      blob_id: image_blob.blob.id,
      attributes: { filename: 'pixel.png' },
    }, $_blobs))
    expect(image.blob?.mime).toBe('image/png')
    expect(image.blob?.width).toBe(1)

    const file = unwrapWrite(await createItem($_db, {
      role: 'file',
      title: 'doc',
      blob_id: file_blob.blob.id,
      attributes: { filename: 'a.pdf' },
    }, $_blobs))
    expect(file.blob?.mime).toBe('application/pdf')

    await expectWriteFailure(createItem($_db, {
      role: 'image',
      title: 'bad',
      blob_id: file_blob.blob.id,
      attributes: { filename: 'a.pdf' },
    }, $_blobs), '不是有效图片')

    await expectWriteFailure(createItem($_db, {
      role: 'image',
      title: 'missing',
      attributes: { filename: 'x.png' },
    }, $_blobs), 'blob_id')

    await expectWriteFailure(createItem($_db, {
      role: 'page',
      title: 'bad page',
      blob_id: file_blob.blob.id,
    }, $_blobs), 'blob_id')
  })
})

describe('unity_name', () => {
  it('全局唯一、可按名查找、系统前缀禁止', async () => {
    const item = await page('named', { unity_name: 'page.home' })
    expect(item.unity_name).toBe('page.home')

    const found = await getItemByUnityName($_db, 'page.home')
    expect(found?.id).toBe(item.id)

    await expectWriteFailure(createItem($_db, {
      role: 'page', title: 'other', unity_name: 'page.home',
    }, $_blobs), '重复')
    await expectWriteFailure(createItem($_db, {
      role: 'page', title: 'sys', unity_name: 'sys.fake',
    }, $_blobs), '系统保留前缀')
    expect(await getItemByUnityName($_db, 'page.none')).toBeNull()
  })
})

describe('itemlink', () => {
  it('target 存在且可更新，拒绝自指和缺失', async () => {
    const a = await page('a')
    const b = await page('b')
    const link = unwrapWrite(await createItem($_db, {
      role: 'itemlink', title: 'link', target_id: a.id,
    }, $_blobs))
    expect(link.target_id).toBe(a.id)

    const updated = unwrapWrite(await updateItem($_db, link.id, { target_id: b.id }, $_blobs))
    expect(updated.target_id).toBe(b.id)

    await expectWriteFailure(updateItem($_db, link.id, { target_id: link.id }, $_blobs), '不能指向自己')
    await expectWriteFailure(createItem($_db, {
      role: 'itemlink', title: 'missing', target_id: 999999,
    }, $_blobs), 'not found')
  })
})

describe('inline item token', () => {
  it('text-block 写入时校验目标，更新时拒绝自指', async () => {
    const target = await page('target')
    const line = unwrapWrite(await createItem($_db, {
      role: 'text-block',
      title: `hello [[item:${target.id}]]`,
      parent_id: target.id,
    }, $_blobs))
    expect(line.title).toContain('[[item:')

    await expectWriteFailure(createItem($_db, {
      role: 'text-block', title: 'bad [[item:999999]]',
    }, $_blobs), 'not found')

    await expectWriteFailure(updateItem($_db, line.id, {
      title: `self [[item:${line.id}]]`,
    }, $_blobs), '不能指向自己')
  })
})

describe('tree / tags / database', () => {
  it('子项顺序、环检测、删除保护', async () => {
    const parent = await page('parent')
    const a = unwrapWrite(await createItem($_db, { role: 'page', parent_id: parent.id }, $_blobs))
    const b = unwrapWrite(await createItem($_db, { role: 'page', parent_id: parent.id }, $_blobs))
    expect(a.order_index).toBe(1)
    expect(b.order_index).toBe(2)

    await expectWriteFailure(updateItem($_db, parent.id, { parent_id: b.id }, $_blobs), '后代')
    await expect(deleteItem($_db, parent.id)).rejects.toThrow('子项')
    await expectWriteFailure(createItem($_db, {
      role: 'page',
      parent_id: unwrapWrite(await createItem($_db, { role: 'text-block' }, $_blobs)).id,
    }, $_blobs), '不允许有子项')
  })

  it('tags 必须是 tag item，删除 tag 会清扫', async () => {
    const tag = unwrapWrite(await createItem($_db, { role: 'tag', title: 'tag' }, $_blobs))
    const item = await page('tagged', { tags: [tag.id, tag.id] })
    expect(item.tags).toEqual([tag.id])

    await expectWriteFailure(createItem($_db, {
      role: 'page', title: 'bad tag', tags: [999999],
    }, $_blobs), 'tag 不存在')

    await deleteItem($_db, tag.id)
    expect((await getItem($_db, item.id)).tags).toEqual([])
  })

  it('database schema 与 unity_name 字段', async () => {
    const database = unwrapWrite(await createItem($_db, {
      role: 'database',
      title: 'db',
      attributes: {
        schema: [
          { name: 'unity_name', type: 'unity_name' },
          { name: 'year', type: 'number' },
        ],
      },
    }, $_blobs))

    const row = unwrapWrite(await createItem($_db, {
      role: 'page',
      parent_id: database.id,
      unity_name: 'game.mario',
      attributes: { year: 1985 },
    }, $_blobs))
    expect(row.unity_name).toBe('game.mario')
    expect(row.attributes['year']).toBe(1985)

    await expectWriteFailure(createItem($_db, {
      role: 'page', parent_id: database.id, attributes: { year: 1 },
    }, $_blobs), 'unity_name')
    await expectWriteFailure(createItem($_db, {
      role: 'page', parent_id: database.id, unity_name: 'game.mario', attributes: { year: 2 },
    }, $_blobs), '重复')
  })

  it('getItems 按输入顺序返回', async () => {
    const a = await page('a')
    const b = await page('b')
    const items = await getItems($_db, [b.id, a.id])
    expect(items.map(item => item.title)).toEqual(['b', 'a'])
  })
})


describe('text block roles', () => {
  it('converts text blocks in place without changing id', async () => {
    const page_item = await page('text roles')
    const block = unwrapWrite(await createItem($_db, {
      role: 'text-block',
      title: 'body',
      parent_id: page_item.id,
    }, $_blobs))
    const heading = unwrapWrite(await convertTextBlock($_db, block.id, 'text-heading-1', 'Title', undefined))
    expect(heading.id).toBe(block.id)
    expect(heading.role).toBe('text-heading-1')
    expect(heading.title).toBe('Title')
    const body = unwrapWrite(await convertTextBlock($_db, block.id, 'text-block', undefined, undefined))
    expect(body.id).toBe(block.id)
    expect(body.role).toBe('text-block')
    expect(body.title).toBe('Title')
  })

  it('rejects conversion of non-text roles', async () => {
    const page_item = await page('text role reject')
    await expectWriteFailure(
      convertTextBlock($_db, page_item.id, 'text-heading-1', undefined, undefined),
      '文本块',
    )
  })

  it('converts to list/todo and validates attributes', async () => {
    const page_item = await page('list roles')
    const block = unwrapWrite(await createItem($_db, {
      role: 'text-block',
      title: '',
      parent_id: page_item.id,
    }, $_blobs))
    const list = unwrapWrite(await convertTextBlock($_db, block.id, 'text-list', '', { list_kind: 'number' }))
    expect(list.id).toBe(block.id)
    expect(list.role).toBe('text-list')
    expect(list.attributes['list_kind']).toBe('number')

    const todo = unwrapWrite(await convertTextBlock($_db, block.id, 'text-todo', '', { checked: false }))
    expect(todo.role).toBe('text-todo')
    expect(todo.attributes['checked']).toBe(false)

    await expectWriteFailure(convertTextBlock($_db, block.id, 'text-list', '', {
      list_kind: 'roman',
    }), 'list_kind')
  })

  it('creates heading roles directly', async () => {
    const page_item = await page('heading roles')
    const heading = unwrapWrite(await createItem($_db, {
      role: 'text-heading-2',
      title: 'Heading',
      parent_id: page_item.id,
    }, $_blobs))
    expect(heading.role).toBe('text-heading-2')
    expect((await getItem($_db, heading.id)).role).toBe('text-heading-2')
  })
})
