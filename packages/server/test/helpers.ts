import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import { createDb, databaseNameOf, ensureDatabaseExists, type DB } from '../src/db/client'
import { BlobService } from '../src/blob/service'
import { BlobStore } from '../src/blob/store'
import { ConfigService } from '../src/config/runtime'

export const TEST_DATABASE_URL = (
  process.env.TEST_DATABASE_URL ??
  'postgres://root:root@127.0.0.1:5432/laibrary_test'
)

export async function prepareTestDb(): Promise<DB> {
  await ensureDatabaseExists(TEST_DATABASE_URL, databaseNameOf(TEST_DATABASE_URL))
  const db = createDb(TEST_DATABASE_URL)
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
  const store = new BlobStore(path.join(dir, 'blobs'))
  await store.init()
  return {
    blobs: new BlobService(db, store),
    store,
    cleanup: () => fs.rm(dir, { recursive: true, force: true }),
  }
}

export async function prepareTestConfig(db: DB): Promise<ConfigService> {
  const service = new ConfigService(db)
  await service.ensure()
  await service.load(true)
  return service
}

export async function closeDb(db: DB): Promise<void> {
  await (db as unknown as { $client: { end(): Promise<void> } }).$client.end()
}

export const TEST_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

export function testPng(): Buffer {
  return Buffer.from(TEST_PNG_BASE64, 'base64')
}
