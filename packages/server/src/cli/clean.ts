import { prepareApp } from '../app'
import { cleanUnreferencedFiles } from '../blob/gc'
import { closeDb } from '../db/client'

async function main() {
  const { db, blob } = await prepareApp()

  const result = await cleanUnreferencedFiles(db, blob)
  console.log(`扫描 ${result.scanned} 个 blob,删除 ${result.deleted} 个孤儿文件(24h 宽限期)`)

  await closeDb(db)
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
