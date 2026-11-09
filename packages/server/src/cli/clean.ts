import { appPrepare } from '../app'
import { dbClose } from '../db/client'
import { z } from 'zod'
import { cleanUnreferencedBlobs } from '../blob/gc'

async function main() {
  const { db, blobs, config_store } = await appPrepare()
  const hours = (
    await config_store.getValue('sys.config.gc_grace_hours', value => z.number().parse(value))
  ) ?? 24
  const grace_ms = Math.max(0, hours) * 60 * 60 * 1000

  const result = await cleanUnreferencedBlobs({
    db,
    blobs,
    grace_ms,
    on_error: error => { console.error('清理 blob 文件失败', error) },
  })
  console.log(
    `扫描 ${result.scanned} 个无引用 blob，删除 ${result.deleted} 个文件（宽限期 ${hours}h）`,
  )

  await dbClose(db)
  process.exit(0)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
