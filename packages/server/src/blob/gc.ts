import fs from 'fs/promises'
import { inArray } from 'drizzle-orm'
import { isFileIDShape, Role } from '@laibrary/types'
import type { DB } from '../db/client'
import { items } from '../db/schema'
import type { FilePool } from './file-pool'

export const FileReferenceKeys: Partial<Record<Role, ReadonlyArray<string>>> = {
  file: ['src'],
  image: ['src', 'cover_src'],
}

export async function collectReferencedFileIds(db: DB): Promise<Set<string>> {
  const file_roles = Object.keys(FileReferenceKeys) as Role[]

  const rows = await db
    .select({ role: items.role, attributes: items.attributes })
    .from(items)
    .where(inArray(items.role, file_roles))

  const refs = new Set<string>()
  for (const row of rows) {
    const keys = FileReferenceKeys[row.role as keyof typeof FileReferenceKeys] ?? []
    for (const key of keys) {
      const value = row.attributes[key]
      if (isFileIDShape(value)) {
        refs.add(value)
      }
    }
  }
  return refs
}

export const __GRACE_PERIOD_MS__ = 24 * 60 * 60 * 1000

export async function cleanUnreferencedFiles(
  db: DB,
  pool: FilePool,
  grace_ms: number = __GRACE_PERIOD_MS__,
  now: number = Date.now(),
): Promise<{ scanned: number, deleted: number }> {
  const refs = await collectReferencedFileIds(db)
  const blobs = await pool.collectBlobFiles()

  let deleted = 0
  for (const blob of blobs) {
    if (
      (!refs.has(blob.file_id)) &&
      ((now - blob.mtime_ms) > grace_ms)
    ) {
      await fs.unlink(blob.path)
      deleted += 1
    }
  }

  return { scanned: blobs.length, deleted }
}
