import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
  closeDb, defined, prepareTestBlobs, prepareTestDb, truncateAll,
} from './helpers'
import type { DB } from '../src/db/client'
import type { BlobService } from '../src/blob/service'
import { ConfigService } from '../src/config/runtime'
import { createItem, getItemByUnityName, listItems, updateItem } from '../src/repo/items'

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

async function config() {
  const service = new ConfigService(db)
  await service.ensure()
  await service.load(true)
  return service
}

describe('system config', () => {
  it('seed 默认值并返回 snapshot', async () => {
    const service = await config()
    const snapshot = await service.load(true)
    expect(snapshot.version).toBe(1)
    expect(snapshot.entries.find(e => e.key === 'sys.config.gc_grace_hours')?.value).toBe(24)
    expect(snapshot.entries.find(e => e.key === 'sys.config.manga_default_direction')?.value).toBe('rtl')

    const database = await getItemByUnityName(db, 'sys.config')
    expect(database?.role).toBe('database')
    expect(database?.unity_name).toBe('sys.config')
  })

  it('update 后缓存失效并生效', async () => {
    const service = await config()
    await service.update('sys.config.gc_grace_hours', 48)
    expect(await service.getValue('sys.config.gc_grace_hours')).toBe(48)
    const snapshot = await service.load(true)
    expect(snapshot.entries.find(e => e.key === 'sys.config.gc_grace_hours')?.value).toBe(48)
  })

  it('类型错误 / 未知 key 被拒绝', async () => {
    const service = await config()
    await expect(service.update('sys.config.gc_grace_hours', '48')).rejects.toThrow('数字')
    await expect(service.update('sys.config.no_such_key', 1)).rejects.toThrow('不存在')
  })

  it('系统项不出现在公共 listing，且不能被通用接口修改/删除', async () => {
    await config()
    const listed = await listItems(db, { limit: 0 })
    expect(listed).toHaveLength(0)

    const database = await getItemByUnityName(db, 'sys.config')
    expect(database).not.toBeNull()
    await expect(updateItem(db, defined(database).id, { title: 'hack' }, blobs)).rejects.toThrow('系统 item')
    await expect(createItem(db, {
      role: 'page',
      title: 'sys item',
      unity_name: 'sys.fake',
    }, blobs)).rejects.toThrow('系统保留前缀')
  })
})
