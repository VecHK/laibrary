import fs from 'fs/promises'
import { isFileIDShape, FileID } from '@laibrary/types'
import type { DB } from '../db/client'
import { items } from '../db/schema'
import type { FilePool } from './file-pool'

export function scanFileRefs(value: unknown, found: FileID[] = []): FileID[] {
  if (typeof value === 'string') {
    if (isFileIDShape(value)) {
      found.push(value)
    }
  } else if (Array.isArray(value)) {
    for (const v of value) {
      scanFileRefs(v, found)
    }
  } else if ((value !== null) && (typeof value === 'object')) {
    for (const v of Object.values(value as Record<string, unknown>)) {
      scanFileRefs(v, found)
    }
  }
  return found
}

export type FileRefEntry = {
  path: string
  fid: FileID
}

export function scanFileRefEntries(
  value: unknown,
  path: string = '',
  found: FileRefEntry[] = [],
): FileRefEntry[] {
  if (typeof value === 'string') {
    if (isFileIDShape(value)) {
      found.push({ path, fid: value })
    }
  } else if (Array.isArray(value)) {
    value.forEach((v, idx) => {
      scanFileRefEntries(v, `${path}[${idx}]`, found)
    })
  } else if ((value !== null) && (typeof value === 'object')) {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      scanFileRefEntries(v, path.length ? `${path}.${key}` : key, found)
    }
  }
  return found
}

export async function checkFileRefsExist(
  file_pool: FilePool,
  attributes: Record<string, unknown>,
): Promise<void> {
  const entries = scanFileRefEntries(attributes)
  for (const { path, fid } of entries) {
    if (!(await file_pool.fileExists(fid))) {
      const field_path = path.length ? `attributes.${path}` : 'attributes'
      throw new Error(`${field_path} 引用的文件不存在: ${fid}`)
    }
  }
}

export async function collectReferencedFileIds(db: DB): Promise<Set<string>> {
  const rows = await db
    .select({ attributes: items.attributes })
    .from(items)

  const refs = new Set<string>()
  for (const row of rows) {
    for (const fid of scanFileRefs(row.attributes)) {
      refs.add(fid)
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
