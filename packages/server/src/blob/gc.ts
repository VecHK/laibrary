import { inArray, sql } from 'drizzle-orm'
import type { DB } from '../db/client'
import { blobs, items } from '../db/schema'
import type { BlobService } from './service'

export const __GRACE_PERIOD_MS__ = 24 * 60 * 60 * 1000

export async function collectReferencedBlobIds(db: DB): Promise<Set<string>> {
  const refs = new Set<string>()
  const item_rows = await db
    .select({ blob_id: items.blob_id })
    .from(items)
  for (const row of item_rows) {
    if (row.blob_id !== null) {refs.add(row.blob_id)}
  }
  const thumb_rows = await db.execute(sql`
    SELECT blob_id FROM thumbnails
  `)
  for (const row of (thumb_rows as unknown as { rows: Array<{ blob_id: string }> }).rows) {
    refs.add(row.blob_id)
  }
  return refs
}

/**
 * GC is DB-driven: only blobs older than the grace period and not referenced by
 * an item or a thumbnail are candidates. No JSON scanning, no full disk walk.
 */
export async function cleanUnreferencedBlobs(
  db: DB,
  blobs_service: BlobService,
  grace_ms: number = __GRACE_PERIOD_MS__,
  now: number = Date.now(),
  batch_size: number = 1000,
): Promise<{ scanned: number, deleted: number }> {
  const cutoff = new Date(now - grace_ms)
  let scanned = 0
  let deleted = 0

  for (;;) {
    const result = await db.execute(sql`
      SELECT b.id AS id
      FROM blobs b
      WHERE b.create_date < ${cutoff}
        AND NOT EXISTS (SELECT 1 FROM items i WHERE i.blob_id = b.id)
        AND NOT EXISTS (SELECT 1 FROM thumbnails t WHERE t.blob_id = b.id)
      LIMIT ${batch_size}
    `)
    const rows = (result as unknown as { rows: Array<{ id: string }> }).rows
    if (rows.length === 0) {break}

    const ids = rows.map(row => row.id)
    scanned += ids.length
    await db.delete(blobs).where(inArray(blobs.id, ids))

    for (const id of ids) {
      try {
        await blobs_service.store.delete(id as never)
        deleted += 1
      } catch (err) {
        console.error(`删除 blob 文件失败: ${id}`, err)
      }
    }

    if (rows.length < batch_size) {break}
  }

  return { scanned, deleted }
}
