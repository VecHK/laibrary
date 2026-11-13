import type { Stats } from 'node:fs'
import { eq } from 'drizzle-orm'
import type { BlobID, BlobMeta } from '@laibrary/types'
import type { DB } from '../db/client'
import { blobs, type BlobRow } from '../db/schema'
import { errorsNotFound, errorsStorage } from '../errors'
import { type WriteResult, writeRun } from '../write-result'
import type { BlobStore, StoredBlob } from './store'

export type PutBlobResult = {
  readonly blob: BlobMeta
  readonly reused: boolean
}

export type BlobService = {
  readonly store: BlobStore
  readonly init: () => Promise<void>
  readonly putFile: (temp_path: string, mime: string) => Promise<WriteResult<PutBlobResult>>
  readonly putBuffer: (buf: Buffer, mime: string) => Promise<WriteResult<PutBlobResult>>
  readonly getMeta: (id: BlobID) => Promise<BlobMeta | null>
  readonly requireMeta: (id: BlobID) => Promise<BlobMeta>
  readonly getRow: (id: BlobID) => Promise<BlobRow | null>
  readonly pathFor: (id: BlobID) => string
  readonly exists: (id: BlobID) => Promise<boolean>
  readonly stat: (id: BlobID) => Promise<Stats>
  readonly deleteBlob: (id: BlobID) => Promise<void>
}

export type CreateBlobServiceOptions = {
  db: DB
  store: BlobStore
}

function rowToMeta(row: BlobRow): BlobMeta {
  return {
    id: row.id,
    size: row.size,
    mime: row.mime,
    width: row.width,
    height: row.height,
  }
}

export function CreateBlobService({
  db: _db,
  store: _store,
}: CreateBlobServiceOptions): BlobService {
  const getMeta = async (id: BlobID): Promise<BlobMeta | null> => {
    const rows = await _db
      .select()
      .from(blobs)
      .where(eq(blobs.id, id))
      .limit(1)
    const row = rows[0]
    return row === undefined ? null : rowToMeta(row)
  }

  const persist = async (stored: StoredBlob): Promise<PutBlobResult> => {
    const existing = await _db
      .select()
      .from(blobs)
      .where(eq(blobs.id, stored.id))
      .limit(1)

    if (existing[0] !== undefined) {
      return { blob: rowToMeta(existing[0]), reused: true }
    } else {
      await _db
        .insert(blobs)
        .values({
          id: stored.id,
          size: stored.size,
          mime: stored.mime,
          width: stored.width,
          height: stored.height,
        })
        .onConflictDoNothing()

      const row = await _db
        .select()
        .from(blobs)
        .where(eq(blobs.id, stored.id))
        .limit(1)
      if (row[0] === undefined) {
        throw errorsStorage(`blob(${stored.id}) 写入数据库失败`)
      } else {
        return { blob: rowToMeta(row[0]), reused: false }
      }
    }
  }

  const requireMeta = async (id: BlobID): Promise<BlobMeta> => {
    const meta = await getMeta(id)
    if (meta === null) {
      throw errorsNotFound(`blob(${id}) not found`)
    } else {
      return meta
    }
  }

  return {
    store: _store,
    init: _store.init,
    putFile: (temp_path, mime) => writeRun(async () => persist(await _store.putFile(temp_path, mime))),
    putBuffer: (buf, mime) => writeRun(async () => persist(await _store.putBuffer(buf, mime))),
    getMeta,
    requireMeta,
    getRow: async id => {
      const rows = await _db
        .select()
        .from(blobs)
        .where(eq(blobs.id, id))
        .limit(1)
      return rows[0] ?? null
    },
    pathFor: _store.pathFor,
    exists: _store.exists,
    stat: _store.stat,
    deleteBlob: async id => {
      await _db.delete(blobs).where(eq(blobs.id, id))
      await _store.delete(id)
    },
  }
}
