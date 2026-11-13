import path from 'node:path'
import { existsSync } from 'node:fs'
import { z } from 'zod'

/** Repository root: this file lives at packages/server/src/config/bootstrap.ts */
export const BOOTSTRAP_REPO_ROOT = path.resolve(import.meta.dirname, '../../../..')

export type BootstrapConfig = {
  readonly database_url: string
  readonly http_api_port: number
  readonly host: string
  readonly storage_path: string
  readonly blob_path: string
  readonly upload_temp_path: string
  readonly log_level: 'debug' | 'info' | 'warn' | 'error'
  readonly migrate_on_start: boolean
}

const zBoolean = z
  .union([z.boolean(), z.string()])
  .transform(value => {
    if (typeof value === 'boolean') {
      return value
    } else {
      return !['false', '0', 'no', 'off', ''].includes(value.toLowerCase())
    }
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
export function bootstrapLoadEnv(): void {
  const env_path = path.join(BOOTSTRAP_REPO_ROOT, '.env')
  if (existsSync(env_path)) {
    process.loadEnvFile(env_path)
  }
}

function resolveFromRoot(value: string): string {
  return path.isAbsolute(value) ? value : path.resolve(BOOTSTRAP_REPO_ROOT, value)
}

export function bootstrapLoadConfig(
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
