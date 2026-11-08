import { prepareApp } from '../app'
import { closeDb } from '../db/client'
import { cleanUnreferencedBlobs } from '../blob/gc'

async function main() {
  const { db, blobs, config_service } = await prepareApp()
  const hours = (
    await config_service.getValue<number>('sys.config.gc_grace_hours')
  ) ?? 24
  const grace_ms = Math.max(0, hours) * 60 * 60 * 1000

  const result = await cleanUnreferencedBlobs(db, blobs, grace_ms)
  console.log(
    `扫描 ${result.scanned} 个无引用 blob，删除 ${result.deleted} 个文件（宽限期 ${hours}h）`,
  )

  await closeDb(db)
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
