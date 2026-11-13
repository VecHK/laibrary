import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  closeDb, defined, prepareTestBlobs, prepareTestDb, truncateAll,
} from './helpers'
import type { DB } from '../src/db/client'
import type { BlobService } from '../src/blob/service'
import { CreateConfigStore } from '../src/config/store'
import { createItem, getItemByUnityName, updateItem } from '../src/repo/items'
import { listItems } from '../src/repo/item-listing'
import type { WriteResult } from '../src/write-result'

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

async function config() {
  const service = CreateConfigStore({ db: $_db, on_error: error => console.error('test config', error) })
  await service.ensure()
  await service.reload()
  return service
}

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

describe('system config', () => {
  it('seed 默认值并返回 snapshot', async () => {
    const service = await config()
    const snapshot = await service.reload()
    expect(snapshot.version).toBe(1)
    expect(snapshot.entries.find(e => e.key === 'sys.config.gc_grace_hours')?.value).toBe(24)
    expect(snapshot.entries.find(e => e.key === 'sys.config.manga_default_direction')?.value).toBe('rtl')

    const database = await getItemByUnityName($_db, 'sys.config')
    expect(database?.role).toBe('database')
    expect(database?.unity_name).toBe('sys.config')
  })

  it('update 后缓存失效并生效', async () => {
    const service = await config()
    await service.update('sys.config.gc_grace_hours', 48)
    expect(await service.getValue('sys.config.gc_grace_hours', value => Number(value))).toBe(48)
    const snapshot = await service.reload()
    expect(snapshot.entries.find(e => e.key === 'sys.config.gc_grace_hours')?.value).toBe(48)
  })

  it('类型错误 / 未知 key 被拒绝', async () => {
    const service = await config()
    await expect(service.update('sys.config.gc_grace_hours', '48')).rejects.toThrow('数字')
    await expect(service.update('sys.config.no_such_key', 1)).rejects.toThrow('不存在')
  })

  it('系统项不出现在公共 listing，且不能被通用接口修改/删除', async () => {
    await config()
    const listed = await listItems($_db, { limit: 0 })
    expect(listed).toHaveLength(0)

    const database = await getItemByUnityName($_db, 'sys.config')
    expect(database).not.toBeNull()
    await expectWriteFailure(updateItem($_db, defined(database).id, { title: 'hack' }, $_blobs), '系统 item')
    await expectWriteFailure(createItem($_db, {
      role: 'page',
      title: 'sys item',
      unity_name: 'sys.fake',
    }, $_blobs), '系统保留前缀')
  })
})
