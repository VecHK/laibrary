import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { initFilePool, splitPoint } from '../src/blob/file-pool'
import { constructFileID } from '@laibrary/types'

let tmp_dir: string

beforeEach(async () => {
  tmp_dir = await fs.mkdtemp(path.join(os.tmpdir(), 'laibrary-test-'))
})

afterEach(async () => {
  await fs.rm(tmp_dir, { recursive: true, force: true })
})

describe('file-pool', () => {
  it('requestFileNumber 连续递增', async () => {
    const pool = await initFilePool(path.join(tmp_dir, 'files'))
    const n1 = await pool.requestFileNumber()
    const n2 = await pool.requestFileNumber()
    expect(n1).toBe(1)
    expect(n2).toBe(2)
  })

  it('saveFile / loadFile / fileExists / deleteFile', async () => {
    const pool = await initFilePool(path.join(tmp_dir, 'files'))
    const fid = constructFileID(await pool.requestFileNumber(), 'png')

    await pool.saveFile(fid, Buffer.from('hello'))
    expect(await pool.fileExists(fid)).toBe(true)
    expect((await pool.loadFile(fid)).toString()).toBe('hello')

    await pool.deleteFile(fid)
    expect(await pool.fileExists(fid)).toBe(false)
  })

  it('分片路径', async () => {
    const pool = await initFilePool(path.join(tmp_dir, 'files'))
    const fid = constructFileID(2001, 'png')
    expect(pool.getFilePath(fid)).toContain(path.join('files', '2000', 'fid_2001.png'))
  })

  it('splitPoint', () => {
    expect(splitPoint(2000, 0)).toBe(0)
    expect(splitPoint(2000, 1999)).toBe(0)
    expect(splitPoint(2000, 2000)).toBe(2000)
    expect(splitPoint(2000, 4001)).toBe(4000)
  })

  it('collectBlobFiles 收集全部 blob', async () => {
    const pool = await initFilePool(path.join(tmp_dir, 'files'))
    await pool.saveFile(constructFileID(1, 'png'), Buffer.from('a'))
    await pool.saveFile(constructFileID(2, 'pdf'), Buffer.from('b'))
    await pool.saveFile(constructFileID(3001, 'jpg'), Buffer.from('c'))

    const blobs = await pool.collectBlobFiles()
    expect(blobs.map(b => b.file_id).sort()).toEqual(['fid_1.png', 'fid_2.pdf', 'fid_3001.jpg'])
  })
})
