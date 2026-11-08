import { prepareApp } from './app'
import { createApi } from './api'

async function main() {
  const { config, db, blobs, config_service, thumbnails } = await prepareApp()
  const app = await createApi(config, db, blobs, config_service, thumbnails)

  app.listen(config.http_api_port, config.host, () => {
    console.log(`Laibrary api listening on http://${config.host}:${config.http_api_port}`)
  })
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
