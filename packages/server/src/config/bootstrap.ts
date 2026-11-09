import path from 'node:path'
import { existsSync } from 'node:fs'
import { z } from 'zod'

/** Repository root: this file lives at packages/server/src/config/bootstrap.ts */
export const REPO_ROOT = path.resolve(import.meta.dirname, '../../../..')

export type BootstrapConfig = {
  database_url: string
  http_api_port: number
  host: string
  storage_path: string
  blob_path: string
  upload_temp_path: string
  log_level: 'debug' | 'info' | 'warn' | 'error'
  migrate_on_start: boolean
}

const zBoolean = z
  .union([z.boolean(), z.string()])
  .transform(value => {
    if (typeof value === 'boolean') {return value}
    return !['false', '0', 'no', 'off', ''].includes(value.toLowerCase())
  })

const zBootstrapEnv = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL 不能为空'),
  HTTP_API_PORT: z.coerce.number().int().min(1).max(65535).default(44998),
  HOST: z.string().default('0.0.0.0'),
  STORAGE_PATH: z.string().default('./storage'),
  BLOB_PATH: z.string().default('./storage/blobs'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  MIGRATE_ON_START: zBoolean.default(true),
})

/** Load the repository-root .env without overriding existing environment variables. */
export function loadRootEnv(): void {
  const env_path = path.join(REPO_ROOT, '.env')
  if (!existsSync(env_path)) {return}
  process.loadEnvFile(env_path)
}

function resolveFromRoot(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(REPO_ROOT, value)
}

export function loadBootstrapConfig(
  env: Record<string, string | undefined> = process.env,
): BootstrapConfig {
  const parsed = zBootstrapEnv.parse(env)
  const storage_path = resolveFromRoot(parsed.STORAGE_PATH)
  const blob_path = resolveFromRoot(parsed.BLOB_PATH)

  return {
    database_url: parsed.DATABASE_URL,
    http_api_port: parsed.HTTP_API_PORT,
    host: parsed.HOST,
    storage_path,
    blob_path,
    upload_temp_path: path.join(storage_path, 'uploadtemp'),
    log_level: parsed.LOG_LEVEL,
    migrate_on_start: parsed.MIGRATE_ON_START,
  }
}
