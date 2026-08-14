import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { prepareTestDb, truncateItems } from './helpers'
import { initFilePool } from '../src/blob/file-pool'
import { cleanUnreferencedFiles, collectReferencedFileIds } from '../src/blob/gc'
import { createItem } from '../src/repo/items'
import { constructFileID } from '@laibrary/types'
import type { DB } from '../src/db/client'

let db: DB
let tmp_dir: string

beforeAll(async () => {
  db = await prepareTestDb()
})

beforeEach(async () => {
  await truncateItems(db)
  tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'laibrary-gc-'))
})

afterAll(async () => {
  await (db as unknown as { $client: { end(): Promise<void> } }).$client.end()
})

const DAY = 24 * 60 * 60 * 1000

describe('GC', () => {
  it('只清理超过宽限期且无引用的 blob', async () => {
    const pool = await initFilePool(path.join(tmp_dir, 'files'))

    const referenced_fid = constructFileID(1, 'png')
    const old_orphan_fid = constructFileID(2, 'pdf')
    const new_orphan_fid = constructFileID(3, 'jpg')

    await pool.saveFile(referenced_fid, Buffer.from('referenced'))
    await pool.saveFile(old_orphan_fid, Buffer.from('old'))
    await pool.saveFile(new_orphan_fid, Buffer.from('new'))

    await createItem(db, {
      role: 'image',
      title: '封面',
      attributes: {
        src: referenced_fid,
        filename: 'cover.png',
        mime: 'image/png',
        size: 10,
        image_width: 100,
        image_height: 100,
      },
    })

    const old_path = pool.getFilePath(old_orphan_fid)
    const now = Date.now()
    await fs.utimes(old_path, new Date(now - 2 * DAY), new Date(now - 2 * DAY))

    const refs = await collectReferencedFileIds(db)
    expect(refs.has(referenced_fid)).toBe(true)
    expect(refs.has(old_orphan_fid)).toBe(false)

    const result = await cleanUnreferencedFiles(db, pool, DAY, now)
    expect(result.deleted).toBe(1)

    expect(await pool.fileExists(referenced_fid)).toBe(true)
    expect(await pool.fileExists(old_orphan_fid)).toBe(false)
    expect(await pool.fileExists(new_orphan_fid)).toBe(true)

    await fs.rm(tmp_dir, { recursive: true, force: true })
  })
})
