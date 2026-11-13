import { serve } from '@hono/node-server'
import { appPrepare } from './app'
import { CreateApi } from './api'

async function main() {
  const { config, db, blobs, config_store, thumbnails } = await appPrepare()
  const app = await CreateApi({ config, db, blobs, config_store, thumbnails })

  serve(
    { fetch: app.fetch, port: config.http_api_port, hostname: config.host },
    () => {
      console.log(`Laibrary api listening on http://${config.host}:${config.http_api_port}`)
    },
  )
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
