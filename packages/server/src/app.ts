import path from 'node:path'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { loadBootstrapConfig, loadRootEnv, type BootstrapConfig } from './config/bootstrap'
import { createDb, databaseNameOf, ensureDatabaseExists, type DB } from './db/client'
import { BlobStore } from './blob/store'
import { BlobService } from './blob/service'
import { ConfigService } from './config/runtime'
import { ThumbnailService } from './thumbnails/service'

export type AppInstance = {
  config: BootstrapConfig
  db: DB
  blob_store: BlobStore
  blobs: BlobService
  config_service: ConfigService
  thumbnails: ThumbnailService
}

export async function prepareApp(): Promise<AppInstance> {
  loadRootEnv()
  const config = loadBootstrapConfig()

  await ensureDatabaseExists(config.database_url, databaseNameOf(config.database_url))

  const db = createDb(config.database_url)
  if (config.migrate_on_start) {
    await migrate(db, {
      migrationsFolder: path.join(import.meta.dirname, '../drizzle'),
    })
  }

  const blob_store = new BlobStore(config.blob_path)
  await blob_store.init()
  const blobs = new BlobService(db, blob_store)

  const config_service = new ConfigService(db)
  await config_service.ensure()
  await config_service.load(true)

  const thumbnails = new ThumbnailService(db, blobs)

  return { config, db, blob_store, blobs, config_service, thumbnails }
}
