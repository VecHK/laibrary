import { and, eq, max } from 'drizzle-orm'
import type {
  ConfigEntry, ConfigSnapshot, DatabaseFieldDef, ItemID,
} from '@laibrary/types'
import {
  __SYSTEM_CONFIG_UNITY_NAME__, zDatabaseAttributes, zUnityName,
} from '@laibrary/types'
import type { DB } from '../db/client'
import { items, type ItemRow } from '../db/schema'
import { errorsConflict, errorsNotFound, errorsPgCode, errorsValidation } from '../errors'
import {
  __SYSTEM_CONFIG_DEFAULTS__, __SYSTEM_CONFIG_SCHEMA__, configDefaultFor,
} from './defaults'
import { configDecodeValue, configEncodeValue, configTypeOf } from './values'

export type ConfigStore = {
  readonly getSystemDatabaseId: () => ItemID
  readonly ensure: () => Promise<ItemID>
  readonly load: () => Promise<ConfigSnapshot>
  readonly reload: () => Promise<ConfigSnapshot>
  readonly getValue: <T>(key: string, parse: (value: unknown) => T) => Promise<T | null>
  readonly update: (key: string, value: unknown) => Promise<void>
  readonly schema: () => readonly DatabaseFieldDef[]
}

export type CreateConfigStoreOptions = {
  db: DB
  on_error: (error: unknown) => void
}

function toConfigEntry(
  row: ItemRow,
  on_error: (error: unknown) => void,
): ConfigEntry | null {
  if (row.kind !== null) {
    return null
  } else if (row.unity_name === null) {
    return null
  } else {
    const attrs = row.attributes
    const type = configTypeOf(attrs['type'])
    const decoded = configDecodeValue(type, attrs['value'])
    if (decoded.ok) {
      return {
        key: row.unity_name,
        title: row.title,
        type,
        value: decoded.data,
      }
    } else {
      on_error(new Error(decoded.error.message, { cause: decoded.error }))
      return null
    }
  }
}

export function CreateConfigStore({
  db,
  on_error,
}: CreateConfigStoreOptions): ConfigStore {
  let __cache: ConfigSnapshot | null = null
  let __system_database_id: ItemID | null = null

  const getSystemDatabaseId = (): ItemID => {
    if (__system_database_id === null) {
      throw new Error('ConfigStore 尚未初始化')
    }
    return __system_database_id
  }

  const seedDefaults = async (): Promise<void> => {
    const database_id = getSystemDatabaseId()
    const max_rows = await db
      .select({ value: max(items.order_index) })
      .from(items)
      .where(eq(items.parent_id, database_id))
    let order_index = max_rows[0]?.value ?? 0

    for (const def of __SYSTEM_CONFIG_DEFAULTS__) {
      const unity_name = zUnityName.parse(def.key)
      const existing = await db
        .select({ id: items.id })
        .from(items)
        .where(eq(items.unity_name, unity_name))
        .limit(1)
      if (existing.length === 0) {
        order_index += 1
        try {
          await db.insert(items).values({
            role: 'page',
            unity_name,
            title: def.title,
            parent_id: database_id,
            order_index,
            attributes: {
              value: configEncodeValue(def.type, def.value),
              type: def.type,
            },
          })
        } catch (err) {
          if (errorsPgCode(err) !== '23505') {
            throw err
          }
        }
      }
    }
  }

  const ensure = async (): Promise<ItemID> => {
    const existing = await db
      .select()
      .from(items)
      .where(and(
        eq(items.role, 'database'),
        eq(items.unity_name, zUnityName.parse(__SYSTEM_CONFIG_UNITY_NAME__)),
      ))
      .limit(2)

    if (existing.length > 1) {
      throw errorsConflict(`系统配置数据库不唯一: ${__SYSTEM_CONFIG_UNITY_NAME__}`)
    } else if (existing.length === 0) {
      const rows = await db
        .insert(items)
        .values({
          role: 'database',
          unity_name: zUnityName.parse(__SYSTEM_CONFIG_UNITY_NAME__),
          title: 'System',
          attributes: { schema: __SYSTEM_CONFIG_SCHEMA__ },
        })
        .returning()
      const row = rows[0]
      if (row === undefined) {
        throw new Error('创建系统配置数据库失败')
      }
      __system_database_id = row.id
    } else {
      const row = existing[0]
      if (row === undefined) {
        throw new Error('读取系统配置数据库失败')
      }
      __system_database_id = row.id
      const parsed = zDatabaseAttributes.safeParse(row.attributes)
      if (!parsed.success) {
        await db
          .update(items)
          .set({
            attributes: { schema: __SYSTEM_CONFIG_SCHEMA__ },
            update_date: new Date(),
          })
          .where(eq(items.id, row.id))
      }
    }

    await seedDefaults()
    return getSystemDatabaseId()
  }

  const load = async (): Promise<ConfigSnapshot> => {
    if (__cache !== null) {
      return __cache
    } else {
      await ensure()
      const database_id = getSystemDatabaseId()
      const rows = await db
        .select()
        .from(items)
        .where(eq(items.parent_id, database_id))

      const entries: ConfigEntry[] = []
      const seen = new Set<string>()

      for (const row of rows) {
        const entry = toConfigEntry(row, on_error)
        if (entry !== null) {
          entries.push(entry)
          seen.add(entry.key)
        }
      }

      for (const def of __SYSTEM_CONFIG_DEFAULTS__) {
        if (!seen.has(def.key)) {
          entries.push({
            key: def.key,
            title: def.title,
            type: def.type,
            value: def.value,
          })
        }
      }

      entries.sort((a, b) => a.key.localeCompare(b.key))
      const version_entry = entries.find(entry => entry.key === 'sys.config.config_version')
      const version = typeof version_entry?.value === 'number' ? version_entry.value : 1

      const snapshot: ConfigSnapshot = { version, entries }
      __cache = snapshot
      return snapshot
    }
  }

  const reload = async (): Promise<ConfigSnapshot> => {
    __cache = null
    return load()
  }

  const getValue = async <T>(
    key: string,
    parse: (value: unknown) => T,
  ): Promise<T | null> => {
    const snapshot = await load()
    const entry = snapshot.entries.find(item => item.key === key)
    if (entry === undefined) {
      return null
    } else {
      return parse(entry.value)
    }
  }

  const update = async (key: string, value: unknown): Promise<void> => {
    if (!key.startsWith(`${__SYSTEM_CONFIG_UNITY_NAME__}.`)) {
      throw errorsValidation(`配置 key 必须以 ${__SYSTEM_CONFIG_UNITY_NAME__}. 开头`)
    } else {
      const unity_name = zUnityName.parse(key)
      const def = configDefaultFor(key)
      const rows = await db
        .select()
        .from(items)
        .where(eq(items.unity_name, unity_name))
        .limit(1)
      const row = rows[0]
      if (row === undefined) {
        throw errorsNotFound(`配置项不存在: ${key}`)
      } else {
        const type = def?.type ?? configTypeOf(row.attributes['type'])
        const encoded = configEncodeValue(type, value)
        await db
          .update(items)
          .set({
            attributes: { ...row.attributes, value: encoded, type },
            update_date: new Date(),
          })
          .where(eq(items.id, row.id))
        __cache = null
      }
    }
  }

  return {
    getSystemDatabaseId,
    ensure,
    load,
    reload,
    getValue,
    update,
    schema: () => __SYSTEM_CONFIG_SCHEMA__,
  }
}
