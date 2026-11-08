import { and, eq, max } from 'drizzle-orm'
import {
  ConfigEntry, ConfigSnapshot, ConfigValueType, DatabaseFieldDef,
  ItemID, SYSTEM_CONFIG_UNITY_NAME, SYSTEM_UNITY_PREFIX,
  zDatabaseAttributes,
} from '@laibrary/types'
import type { DB } from '../db/client'
import { items, type ItemRow } from '../db/schema'
import { conflict, notFound, pgErrorCode, validationError } from '../errors'
import {
  DEFAULT_CONFIG, SYSTEM_CONFIG_SCHEMA, defaultFor,
} from './defaults'

function encodeValue(type: ConfigValueType, value: unknown): string {
  switch (type) {
    case 'string':
      if (typeof value !== 'string') throw validationError('配置值需要字符串')
      return value
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw validationError('配置值需要有限数字')
      }
      return String(value)
    case 'boolean':
      if (typeof value !== 'boolean') throw validationError('配置值需要布尔值')
      return value ? 'true' : 'false'
    case 'json':
      return JSON.stringify(value)
  }
}

function decodeValue(type: ConfigValueType, raw: unknown): unknown {
  if (typeof raw !== 'string') {
    throw validationError(`配置值不是字符串（type=${type}）`)
  }
  switch (type) {
    case 'string':
      return raw
    case 'number': {
      const value = Number(raw)
      if (!Number.isFinite(value)) throw validationError(`配置值不是数字: ${raw}`)
      return value
    }
    case 'boolean':
      if (raw === 'true') return true
      if (raw === 'false') return false
      throw validationError(`配置值不是布尔值: ${raw}`)
    case 'json':
      return JSON.parse(raw) as unknown
  }
}

function typeOf(raw: unknown): ConfigValueType {
  if (raw === 'string' || raw === 'number' || raw === 'boolean' || raw === 'json') {
    return raw
  }
  return 'json'
}

export class ConfigService {
  private cache: ConfigSnapshot | null = null
  private system_database_id: ItemID | null = null

  constructor(private readonly db: DB) {}

  getSystemDatabaseId(): ItemID {
    if (this.system_database_id === null) {
      throw new Error('ConfigService 尚未初始化')
    }
    return this.system_database_id
  }

  async ensure(): Promise<ItemID> {
    const existing = await this.db
      .select()
      .from(items)
      .where(and(
        eq(items.role, 'database'),
        eq(items.unity_name, SYSTEM_CONFIG_UNITY_NAME),
      ))
      .limit(2)

    if (existing.length > 1) {
      throw conflict(`系统配置数据库不唯一: ${SYSTEM_CONFIG_UNITY_NAME}`)
    }

    if (existing.length === 0) {
      const rows = await this.db
        .insert(items)
        .values({
          role: 'database',
          unity_name: SYSTEM_CONFIG_UNITY_NAME,
          title: 'System',
          attributes: { schema: SYSTEM_CONFIG_SCHEMA },
        })
        .returning()
      this.system_database_id = (rows[0] as ItemRow).id
    } else {
      const row = existing[0] as ItemRow
      this.system_database_id = row.id
      const parsed = zDatabaseAttributes.safeParse(row.attributes)
      if (!parsed.success) {
        await this.db
          .update(items)
          .set({
            attributes: { schema: SYSTEM_CONFIG_SCHEMA },
            update_date: new Date(),
          })
          .where(eq(items.id, row.id))
      }
    }

    await this.seedDefaults()
    return this.getSystemDatabaseId()
  }

  private async seedDefaults(): Promise<void> {
    const database_id = this.getSystemDatabaseId()
    const max_rows = await this.db
      .select({ value: max(items.order_index) })
      .from(items)
      .where(eq(items.parent_id, database_id))
    let order_index = max_rows[0]?.value ?? 0

    for (const def of DEFAULT_CONFIG) {
      const existing = await this.db
        .select({ id: items.id })
        .from(items)
        .where(eq(items.unity_name, def.key))
        .limit(1)
      if (existing.length !== 0) continue

      order_index += 1
      try {
        await this.db.insert(items).values({
          role: 'page',
          unity_name: def.key,
          title: def.title,
          parent_id: database_id,
          order_index,
          attributes: {
            value: encodeValue(def.type, def.value),
            type: def.type,
          },
        })
      } catch (err) {
        if (pgErrorCode(err) === '23505') continue
        throw err
      }
    }
  }

  async load(force: boolean = false): Promise<ConfigSnapshot> {
    if (this.cache !== null && !force) return this.cache

    await this.ensure()
    const database_id = this.getSystemDatabaseId()
    const rows = await this.db
      .select()
      .from(items)
      .where(eq(items.parent_id, database_id))

    const entries: ConfigEntry[] = []
    const seen = new Set<string>()

    for (const row of rows) {
      if (row.kind !== null) continue
      const unity_name = row.unity_name
      if (unity_name === null) continue
      const attrs = row.attributes as Record<string, unknown>
      const type = typeOf(attrs['type'])
      let value: unknown
      try {
        value = decodeValue(type, attrs['value'])
      } catch {
        continue
      }
      entries.push({
        key: unity_name,
        title: row.title,
        type,
        value,
      })
      seen.add(unity_name)
    }

    for (const def of DEFAULT_CONFIG) {
      if (seen.has(def.key)) continue
      entries.push({
        key: def.key,
        title: def.title,
        type: def.type,
        value: def.value,
      })
    }

    entries.sort((a, b) => a.key.localeCompare(b.key))
    const version_entry = entries.find(entry => entry.key === 'sys.config.config_version')
    const version = typeof version_entry?.value === 'number' ? version_entry.value : 1

    this.cache = { version, entries }
    return this.cache
  }

  async getValue<T = unknown>(key: string): Promise<T | undefined> {
    const snapshot = await this.load()
    return snapshot.entries.find(entry => entry.key === key)?.value as T | undefined
  }

  async update(key: string, value: unknown): Promise<void> {
    if (!key.startsWith(`${SYSTEM_CONFIG_UNITY_NAME}.`)) {
      throw validationError(`配置 key 必须以 ${SYSTEM_CONFIG_UNITY_NAME}. 开头`)
    }
    const def = defaultFor(key)
    const rows = await this.db
      .select()
      .from(items)
      .where(eq(items.unity_name, key))
      .limit(1)
    const row = rows[0]
    if (row === undefined) throw notFound(`配置项不存在: ${key}`)

    const attrs = row.attributes as Record<string, unknown>
    const type = def?.type ?? typeOf(attrs['type'])
    const encoded = encodeValue(type, value)

    await this.db
      .update(items)
      .set({
        attributes: { ...attrs, value: encoded, type },
        update_date: new Date(),
      })
      .where(eq(items.id, row.id))

    this.cache = null
  }

  isSystemUnityName(unity_name: string | null | undefined): boolean {
    return typeof unity_name === 'string' && unity_name.startsWith(SYSTEM_UNITY_PREFIX)
  }

  schema(): DatabaseFieldDef[] {
    return SYSTEM_CONFIG_SCHEMA
  }
}
