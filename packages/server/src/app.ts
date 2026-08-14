import path from 'path'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { loadConfig } from './config'
import { createDb, databaseNameOf, ensureDatabaseExists, type DB } from './db/client'
import { initFilePool, type FilePool } from './blob/file-pool'

export type AppInstance = {
  config: ReturnType<typeof loadConfig>
  db: DB
  blob: FilePool
}

export async function prepareApp(): Promise<AppInstance> {
  const config = loadConfig()

  await ensureDatabaseExists(config.database_url, databaseNameOf(config.database_url))

  const db = createDb(config.database_url)
  await migrate(db, {
    migrationsFolder: path.join(import.meta.dirname, '../drizzle'),
  })

  const blob = await initFilePool(config.filepool_path)

  return { config, db, blob }
}
