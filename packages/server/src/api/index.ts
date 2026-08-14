import Koa from 'koa'
import Router from '@koa/router'
import cors from '@koa/cors'
import { bodyParser } from '@koa/bodyparser'
import { ZodError } from 'zod'
import type { Config } from '../config'
import type { DB } from '../db/client'
import type { FilePool } from '../blob/file-pool'
import { ActionRoute } from './actions'
import { singleUploadRouter } from './file-routes'

export function createApi(
  config: Config,
  db: DB,
  blob: FilePool,
) {
  const app = new Koa()
  const router = new Router()

  app.use(cors())

  const upload_router = singleUploadRouter(config, blob)
  router.use('/', upload_router.routes(), upload_router.allowedMethods())

  app.use(bodyParser())

  router.post('/action', async (ctx) => {
    const request_body: unknown = ctx.request.body
    if (
      (typeof request_body === 'object') &&
      (request_body !== null)
    ) {
      const { action, payload } = request_body as {
        action: string
        payload: never
      }

      const actions = ActionRoute(db, blob)
      const act = actions[action as keyof typeof actions]

      if (typeof act === 'function') {
        try {
          const result = await act(payload)
          ctx.status = 200
          ctx.type = 'application/json'
          ctx.body = JSON.stringify(result)
        } catch (err) {
          if (err instanceof ZodError) {
            ctx.status = 400
            ctx.type = 'application/json'
            ctx.body = JSON.stringify({ message: err.message })
          } else if (err instanceof Error) {
            ctx.status = 500
            ctx.type = 'application/json'
            ctx.body = JSON.stringify({ message: err.message })
          } else {
            ctx.status = 500
            ctx.type = 'application/json'
            ctx.body = JSON.stringify({ message: String(err) })
          }
        }
      } else {
        ctx.status = 400
        ctx.type = 'application/json'
        ctx.body = JSON.stringify({ message: `unknown ACTION: ${action}` })
      }
    } else {
      ctx.status = 400
      ctx.type = 'application/json'
      ctx.body = JSON.stringify({ message: 'require json body' })
    }
  })

  app.use(router.routes())
  app.use(router.allowedMethods())

  return app
}
