import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'

const { Pool } = pg

export type DB = ReturnType<typeof createDb>

export function createDb(database_url: string) {
  const pool = new Pool({
    connectionString: database_url,
    max: 10,
  })
  return drizzle({ client: pool })
}

export async function ensureDatabaseExists(
  database_url: string,
  database_name: string,
): Promise<void> {
  if (!/^[a-zA-Z0-9_]+$/.test(database_name)) {
    throw new Error(`非法的数据库名: ${database_name}`)
  }

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

export function databaseNameOf(database_url: string): string {
  return new URL(database_url).pathname.replace(/^\//, '')
}

export async function closeDb(db: DB): Promise<void> {
  const client = (db as unknown as { $client: pg.Pool }).$client
  await client.end()
}
