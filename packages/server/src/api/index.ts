import Koa from 'koa'
import Router from '@koa/router'
import cors from '@koa/cors'
import { bodyParser } from '@koa/bodyparser'
import { ZodError } from 'zod'
import type { ActionTable } from '@laibrary/types'
import { zActionPayloads } from '@laibrary/types'
import type { BootstrapConfig } from '../config/bootstrap'
import type { DB } from '../db/client'
import type { BlobService } from '../blob/service'
import type { ConfigService } from '../config/runtime'
import type { ThumbnailService } from '../thumbnails/service'
import { AppError } from '../errors'
import { ActionRoute } from './actions'
import { createBlobRouter } from './blob-routes'
import { createThumbRouter } from './thumb-routes'

function errorBody(err: unknown): { status: number, body: unknown } {
  if (err instanceof AppError) {
    return {
      status: err.status,
      body: { message: err.message, code: err.code, issues: err.issues },
    }
  }
  if (err instanceof ZodError) {
    return {
      status: 400,
      body: { message: err.message, code: 'VALIDATION', issues: err.issues },
    }
  }
  return {
    status: 500,
    body: {
      message: err instanceof Error ? err.message : String(err),
      code: 'INTERNAL',
    },
  }
}

export async function createApi(
  config: BootstrapConfig,
  db: DB,
  blobs_service: BlobService,
  config_service: ConfigService,
  thumbnails: ThumbnailService,
) {
  const app = new Koa()
  const router = new Router()

  app.use(cors())

  const blob_router = createBlobRouter(
    config,
    blobs_service,
    async () => (
      await config_service.getValue<number>('sys.config.upload_max_bytes')
    ) ?? 256 * 1024 * 1024,
  )
  app.use(blob_router.routes())
  app.use(blob_router.allowedMethods())
  const thumb_router = createThumbRouter(thumbnails, blobs_service)
  app.use(thumb_router.routes())
  app.use(thumb_router.allowedMethods())

  app.use(bodyParser({ jsonLimit: '4mb' }))

  router.post('/action', async (ctx) => {
    const action = ctx.request.body as { action?: unknown, payload?: unknown } | undefined
    if (action === undefined || typeof action.action !== 'string') {
      ctx.status = 400
      ctx.type = 'application/json'
      ctx.body = { message: 'require { action, payload }', code: 'BAD_REQUEST' }
      return
    }

    const name = action.action
    if (!Object.hasOwn(zActionPayloads, name)) {
      ctx.status = 400
      ctx.type = 'application/json'
      ctx.body = { message: `unknown ACTION: ${name}`, code: 'BAD_REQUEST' }
      return
    }

    try {
      const schema = zActionPayloads[name as keyof typeof zActionPayloads]
      const payload = schema.parse(action.payload)
      const actions = ActionRoute(db, blobs_service, config_service) as ActionTable
      const act = (actions as unknown as Record<string, (payload: unknown) => Promise<unknown>>)[name]
      if (act === undefined) {
        ctx.status = 400
        ctx.body = { message: `unknown ACTION: ${name}`, code: 'BAD_REQUEST' }
        return
      }
      const result = await act(payload)
      ctx.status = 200
      ctx.type = 'application/json'
      ctx.body = result
    } catch (err) {
      const { status, body } = errorBody(err)
      if (status >= 500) {console.error(`[action:${name}]`, err)}
      ctx.status = status
      ctx.type = 'application/json'
      ctx.body = body
    }
  })

  app.use(router.routes())
  app.use(router.allowedMethods())

  return app
}
