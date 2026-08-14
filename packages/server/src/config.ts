import path from 'path'
import { readFileSync } from 'node:fs'

export type Config = {
  database_url: string
  http_api_port: number
  storage_path: string
  filepool_path: string
  upload_temp_path: string
}

type ConfigJSON = {
  database_url?: unknown
  http_api_port?: unknown
  storage_path?: unknown
  filepool_path?: unknown
}

function readNumber(json_obj: ConfigJSON, prop: 'http_api_port', env: string | undefined, fallback: number): number {
  const json_val = json_obj[prop]
  if (typeof json_val === 'number') {
    return json_val
  } else if (env !== undefined) {
    const env_num = Number.parseInt(env)
    if (!Number.isNaN(env_num)) {
      return env_num
    }
  }
  return fallback
}

function readString(json_obj: ConfigJSON, prop: 'storage_path' | 'filepool_path', fallback: string): string {
  const json_val = json_obj[prop]
  if (typeof json_val === 'string' && json_val.length > 0) {
    return json_val
  }
  return fallback
}

const __dirname = import.meta.dirname

const DEFAULT_CONFIG_PATH = path.join(__dirname, '../config.json')

export function loadConfig(
  config_path: string = DEFAULT_CONFIG_PATH,
): Config {
  let json_obj: ConfigJSON = {}
  try {
    json_obj = JSON.parse(
      readFileSync(config_path, { encoding: 'utf-8' }),
    ) as ConfigJSON
  } catch (cause) {
    throw new Error(`config.json 读取失败: ${config_path}`, { cause })
  }

  const database_url = (
    process.env.DATABASE_URL ??
    (typeof json_obj.database_url === 'string' ? json_obj.database_url : '')
  )
  if (database_url.length === 0) {
    throw new Error('缺少 database_url 配置')
  }

  const http_api_port = readNumber(
    json_obj, 'http_api_port', process.env.HTTP_API_PORT, 44998,
  )

  const storage_path = path.resolve(
    __dirname, '..',
    readString(json_obj, 'storage_path', './storage'),
  )

  const filepool_path = path.resolve(
    __dirname, '..',
    readString(json_obj, 'filepool_path', './storage/files'),
  )

  return {
    database_url,
    http_api_port,
    storage_path,
    filepool_path,
    upload_temp_path: path.join(storage_path, './uploadtemp'),
  }
}
