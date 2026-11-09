import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

const { Pool } = pg

export type DB = ReturnType<typeof CreateDb>
export type Tx = Parameters<Parameters<DB['transaction']>[0]>[0]
export type DbLike = DB | Tx

export type CreateDbOptions = {
  database_url: string
  max?: number | undefined
}

export function CreateDb({
  database_url,
  max = 10,
}: CreateDbOptions) {
  const pool = new Pool({
    connectionString: database_url,
    max,
  })
  return drizzle({ client: pool })
}


export async function dbEnsureExists(
  database_url: string,
  database_name: string,
): Promise<void> {
  if (!/^[a-zA-Z0-9_]+$/.test(database_name)) {
    throw new Error(`非法的数据库名: ${database_name}`)
  } else {
    const url = new URL(database_url)
    url.pathname = '/postgres'
    const admin_pool = new Pool({ connectionString: url.toString() })

    try {
      const found = await admin_pool.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [database_name],
      )
      if (found.rowCount === 0) {
        await admin_pool.query(`CREATE DATABASE "${database_name}"`)
      }
    } finally {
      await admin_pool.end()
    }
  }
}

export function dbNameOf(database_url: string): string {
  return new URL(database_url).pathname.replace(/^\//, '')
}

function isDbWithPool(db: DB): db is DB & { $client: pg.Pool } {
  return typeof db === 'object' && db !== null && '$client' in db
}

export async function dbClose(db: DB): Promise<void> {
  if (isDbWithPool(db)) {
    await db.$client.end()
  } else {
    throw new Error('数据库句柄缺少 $client')
  }
}
