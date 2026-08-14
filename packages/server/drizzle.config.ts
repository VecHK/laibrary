import { defineConfig } from 'drizzle-kit'

const default_url = 'postgres://root:root@127.0.0.1:5432/root'

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? default_url,
  },
})
