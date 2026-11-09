import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import { CreateDb, dbClose, dbNameOf, dbEnsureExists, type DB } from '../src/db/client'
import { CreateBlobService, type BlobService } from '../src/blob/service'
import { CreateBlobStore, type BlobStore } from '../src/blob/store'
import { CreateConfigStore, type ConfigStore } from '../src/config/store'

export const TEST_DATABASE_URL = (
  process.env.TEST_DATABASE_URL ??
  'postgres://root:root@127.0.0.1:5432/laibrary_test'
)

export async function prepareTestDb(): Promise<DB> {
  await dbEnsureExists(TEST_DATABASE_URL, dbNameOf(TEST_DATABASE_URL))
  const db = CreateDb({ database_url: TEST_DATABASE_URL })
  await db.execute(sql`DROP SCHEMA IF EXISTS public CASCADE`)
  await db.execute(sql`DROP SCHEMA IF EXISTS drizzle CASCADE`)
  await db.execute(sql`CREATE SCHEMA public`)
  await migrate(db, {
    migrationsFolder: path.join(import.meta.dirname, '../drizzle'),
  })
  return db
}

export async function truncateAll(db: DB): Promise<void> {
  await db.execute(sql`TRUNCATE items, thumbnails, blobs RESTART IDENTITY CASCADE`)
}

export async function prepareTestBlobs(db: DB): Promise<{
  blobs: BlobService
  store: BlobStore
  cleanup: () => Promise<void>
}> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'laibrary-test-blobs-'))
  const store = CreateBlobStore({
    root: path.join(dir, 'blobs'),
    on_error: error => { console.error('test blob cleanup', error) },
  })
  await store.init()
  return {
    blobs: CreateBlobService({ db, store }),
    store,
    cleanup: () => fs.rm(dir, { recursive: true, force: true }),
  }
}

export async function prepareTestConfig(db: DB): Promise<ConfigStore> {
  const service = CreateConfigStore({
    db,
    on_error: error => { console.error('test config', error) },
  })
  await service.ensure()
  await service.reload()
  return service
}

export async function closeDb(db: DB): Promise<void> {
  await dbClose(db)
}

export function defined<T>(value: T | null | undefined): T {
  if (value === null || value === undefined) {
    throw new Error('expected value to be defined')
  } else {
    return value
  }
}

export const TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

export function testPng(): Buffer {
  return Buffer.from(TEST_PNG_BASE64, 'base64')
}
