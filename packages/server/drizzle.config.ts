import path from 'node:path'
import { existsSync } from 'node:fs'
import { defineConfig } from 'drizzle-kit'

for (const candidate of [
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../../.env'),
]) {
  if (existsSync(candidate)) {
    process.loadEnvFile(candidate)
    break
  }
}

const default_url = 'postgres://root:root@127.0.0.1:5432/root'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? default_url,
  },
})
