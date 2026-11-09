import type { ConfigValueType, DatabaseFieldDef } from '@laibrary/types'

export type ConfigDefault = {
  readonly key: string
  readonly title: string
  readonly type: ConfigValueType
  readonly value: unknown
}

export const __SYSTEM_CONFIG_SCHEMA__: readonly DatabaseFieldDef[] = [
  { name: 'unity_name', type: 'unity_name' },
  { name: 'value', type: 'string' },
  { name: 'type', type: 'string' },
] as const

export const __SYSTEM_CONFIG_DEFAULTS__: readonly ConfigDefault[] = [
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
] as const

export function configDefaultFor(key: string): ConfigDefault | undefined {
  return __SYSTEM_CONFIG_DEFAULTS__.find(item => item.key === key)
}
