import { prepareApp } from './app'
import { createApi } from './api'

async function main() {
  const { config, db, blob } = await prepareApp()

  const app = createApi(config, db, blob)
  app.listen(config.http_api_port, () => {
    console.log(`Laibrary api listening on http://127.0.0.1:${config.http_api_port}`)
  })
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
