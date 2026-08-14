import path from 'path'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { sql } from 'drizzle-orm'
import { createDb, databaseNameOf, ensureDatabaseExists, type DB } from '../src/db/client'

export const TEST_DATABASE_URL = (
  process.env.TEST_DATABASE_URL ??
  'postgres://root:root@127.0.0.1:5432/laibrary_test'
)

export async function prepareTestDb(): Promise<DB> {
  await ensureDatabaseExists(TEST_DATABASE_URL, databaseNameOf(TEST_DATABASE_URL))
  const db = createDb(TEST_DATABASE_URL)
  await migrate(db, {
    migrationsFolder: path.join(import.meta.dirname, '../drizzle'),
  })
  return db
}

export async function truncateItems(db: DB): Promise<void> {
  await db.execute(sql`TRUNCATE items RESTART IDENTITY CASCADE`)
}
