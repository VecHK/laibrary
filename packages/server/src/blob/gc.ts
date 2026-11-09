import { inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import type { BlobID } from '@laibrary/types'
import { zBlobID } from '@laibrary/types'
import type { DB } from '../db/client'
import { blobs, items } from '../db/schema'
import type { BlobService } from './service'

export const __BLOB_GC_GRACE_PERIOD_MS__ = 24 * 60 * 60 * 1000

const zBlobIdRow = z.object({ id: zBlobID })
const zThumbBlobRow = z.object({ blob_id: zBlobID })

export async function collectReferencedBlobIds(db: DB): Promise<Set<BlobID>> {
  const refs = new Set<BlobID>()
  const item_rows = await db
    .select({ blob_id: items.blob_id })
    .from(items)
  for (const row of item_rows) {
    if (row.blob_id !== null) {
      refs.add(row.blob_id)
    }
  }
  const thumb_result = await db.execute(sql`
    SELECT blob_id FROM thumbnails
  `)
  const thumb_rows = z.array(zThumbBlobRow).parse(thumb_result.rows)
  for (const row of thumb_rows) {
    refs.add(row.blob_id)
  }
  return refs
}

export type CleanUnreferencedBlobsOptions = {
  db: DB
  blobs: BlobService
  grace_ms?: number | undefined
  now?: number | undefined
  batch_size?: number | undefined
  on_error: (error: unknown) => void
}

/**
 * GC is DB-driven: only blobs older than the grace period and not referenced by
 * an item or a thumbnail are candidates. No JSON scanning, no full disk walk.
 */
export async function cleanUnreferencedBlobs({
  db,
  blobs: blobs_service,
  grace_ms = __BLOB_GC_GRACE_PERIOD_MS__,
  now = Date.now(),
  batch_size = 1000,
  on_error,
}: CleanUnreferencedBlobsOptions): Promise<{ scanned: number, deleted: number }> {
  const cutoff = new Date(now - grace_ms)
  let scanned = 0
  let deleted = 0
  let has_more = true

  while (has_more) {
    const result = await db.execute(sql`
      SELECT b.id AS id
      FROM blobs b
      WHERE b.create_date < ${cutoff}
        AND NOT EXISTS (SELECT 1 FROM items i WHERE i.blob_id = b.id)
        AND NOT EXISTS (SELECT 1 FROM thumbnails t WHERE t.blob_id = b.id)
      LIMIT ${batch_size}
    `)
    const rows = z.array(zBlobIdRow).parse(result.rows)
    if (rows.length === 0) {
      has_more = false
    } else {
      const ids = rows.map(row => row.id)
      scanned += ids.length
      await db.delete(blobs).where(inArray(blobs.id, ids))

      for (const id of ids) {
        try {
          await blobs_service.store.delete(id)
          deleted += 1
        } catch (error) {
          on_error(error)
        }
      }

      has_more = rows.length >= batch_size
    }
  }

  return { scanned, deleted }
}
