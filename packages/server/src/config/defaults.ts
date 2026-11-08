import type { ConfigValueType, DatabaseFieldDef } from '@laibrary/types'

export type ConfigDefault = {
  key: string
  title: string
  type: ConfigValueType
  value: unknown
}

export const SYSTEM_CONFIG_UNITY_NAME = 'sys.config'

export const SYSTEM_CONFIG_SCHEMA: DatabaseFieldDef[] = [
  { name: 'unity_name', type: 'unity_name' },
  { name: 'value', type: 'string' },
  { name: 'type', type: 'string' },
]

export const DEFAULT_CONFIG: ConfigDefault[] = [
  {
    key: 'sys.config.gc_grace_hours',
    title: 'GC 宽限期（小时）',
    type: 'number',
    value: 24,
  },
  {
    key: 'sys.config.upload_max_bytes',
    title: '上传上限（字节）',
    type: 'number',
    value: 256 * 1024 * 1024,
  },
  {
    key: 'sys.config.manga_default_direction',
    title: '漫画默认阅读方向',
    type: 'string',
    value: 'rtl',
  },
  {
    key: 'sys.config.ui_page_size',
    title: '列表每页数量',
    type: 'number',
    value: 50,
  },
  {
    key: 'sys.config.config_version',
    title: '配置版本',
    type: 'number',
    value: 1,
  },
]

export function defaultFor(key: string): ConfigDefault | undefined {
  return DEFAULT_CONFIG.find(item => item.key === key)
}
