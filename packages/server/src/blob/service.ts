import { eq } from 'drizzle-orm'
import type { BlobID, BlobMeta } from '@laibrary/types'
import type { DB } from '../db/client'
import { blobs, type BlobRow } from '../db/schema'
import { notFound, storageError } from '../errors'
import { BlobStore, type StoredBlob } from './store'

export type PutBlobResult = {
  blob: BlobMeta
  reused: boolean
}

function rowToMeta(row: BlobRow): BlobMeta {
  return {
    id: row.id as BlobID,
    size: row.size,
    mime: row.mime,
    width: row.width,
    height: row.height,
  }
}

export class BlobService {
  readonly store: BlobStore

  constructor(readonly db: DB, store: BlobStore) {
    this.store = store
  }

  async init(): Promise<void> {
    await this.store.init()
  }

  private async persist(stored: StoredBlob): Promise<PutBlobResult> {
    const existing = await this.db
      .select()
      .from(blobs)
      .where(eq(blobs.id, stored.id))
      .limit(1)

    if (existing[0] !== undefined) {
      return { blob: rowToMeta(existing[0]), reused: true }
    }

    await this.db
      .insert(blobs)
      .values({
        id: stored.id,
        size: stored.size,
        mime: stored.mime,
        width: stored.width,
        height: stored.height,
      })
      .onConflictDoNothing()

    const row = await this.db
      .select()
      .from(blobs)
      .where(eq(blobs.id, stored.id))
      .limit(1)

    if (row[0] === undefined) {
      throw storageError(`blob(${stored.id}) 写入数据库失败`)
    }
    return { blob: rowToMeta(row[0]), reused: false }
  }

  async putFile(temp_path: string, mime: string): Promise<PutBlobResult> {
    const stored = await this.store.putFile(temp_path, mime)
    return this.persist(stored)
  }

  async putBuffer(buf: Buffer, mime: string): Promise<PutBlobResult> {
    const stored = await this.store.putBuffer(buf, mime)
    return this.persist(stored)
  }

  async getMeta(id: BlobID): Promise<BlobMeta | null> {
    const rows = await this.db
      .select()
      .from(blobs)
      .where(eq(blobs.id, id))
      .limit(1)
    return rows[0] === undefined ? null : rowToMeta(rows[0])
  }

  async requireMeta(id: BlobID): Promise<BlobMeta> {
    const meta = await this.getMeta(id)
    if (meta === null) throw notFound(`blob(${id}) not found`)
    return meta
  }

  async getRow(id: BlobID): Promise<BlobRow | null> {
    const rows = await this.db
      .select()
      .from(blobs)
      .where(eq(blobs.id, id))
      .limit(1)
    return rows[0] ?? null
  }

  pathFor(id: BlobID): string {
    return this.store.pathFor(id)
  }

  async exists(id: BlobID): Promise<boolean> {
    return this.store.exists(id)
  }

  async stat(id: BlobID): Promise<import('node:fs').Stats> {
    return this.store.stat(id)
  }

  async deleteBlob(id: BlobID): Promise<void> {
    await this.db.delete(blobs).where(eq(blobs.id, id))
    await this.store.delete(id)
  }
}
