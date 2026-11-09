import path from 'node:path'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { bootstrapLoadConfig, bootstrapLoadEnv, type BootstrapConfig } from './config/bootstrap'
import { CreateDb, dbNameOf, dbEnsureExists, type DB } from './db/client'
import { CreateBlobStore, type BlobStore } from './blob/store'
import { CreateBlobService, type BlobService } from './blob/service'
import { CreateConfigStore, type ConfigStore } from './config/store'
import { CreateThumbnailService, type ThumbnailService } from './thumbnails/service'

export type AppInstance = {
  readonly config: BootstrapConfig
  readonly db: DB
  readonly blob_store: BlobStore
  readonly blobs: BlobService
  readonly config_store: ConfigStore
  readonly thumbnails: ThumbnailService
}

export async function appPrepare(): Promise<AppInstance> {
  bootstrapLoadEnv()
  const config = bootstrapLoadConfig()

  await dbEnsureExists(config.database_url, dbNameOf(config.database_url))

  const db = CreateDb({ database_url: config.database_url })
  if (config.migrate_on_start) {
    await migrate(db, {
      migrationsFolder: path.join(import.meta.dirname, '../drizzle'),
    })
  }

  const blob_store = CreateBlobStore({
    root: config.blob_path,
    on_error: error => {
      console.error('[blob] cleanup failed', error)
    },
  })
  await blob_store.init()
  const blobs = CreateBlobService({ db, store: blob_store })

  const config_store = CreateConfigStore({
    db,
    on_error: error => {
      console.error('[config] invalid entry', error)
    },
  })
  await config_store.ensure()
  await config_store.reload()

  const thumbnails = CreateThumbnailService({ db, blobs })

  return { config, db, blob_store, blobs, config_store, thumbnails }
}
