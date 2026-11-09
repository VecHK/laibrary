import Koa, { type Context } from 'koa'
import Router from '@koa/router'
import cors from '@koa/cors'
import { bodyParser } from '@koa/bodyparser'
import { z, ZodError } from 'zod'
import type { ActionName } from '@laibrary/types'
import { __RPC_ACTION_NAMES__, zActionPayloads } from '@laibrary/types'
import type { BootstrapConfig } from '../config/bootstrap'
import type { DB } from '../db/client'
import type { BlobService } from '../blob/service'
import type { ConfigStore } from '../config/store'
import type { ThumbnailService } from '../thumbnails/service'
import { errorsIsAppError, errorsBadRequest } from '../errors'
import { CreateActionRoute } from './actions'
import { CreateBlobRouter } from './blob-routes'
import { CreateThumbRouter } from './thumb-routes'

const zActionRequest = z.object({
  action: z.string(),
  payload: z.unknown().optional(),
})

function errorBody(err: unknown): { status: number, body: unknown } {
  if (errorsIsAppError(err)) {
    return {
      status: err.status,
      body: { message: err.message, code: err.code, issues: err.issues },
    }
  } else if (err instanceof ZodError) {
    return {
      status: 400,
      body: { message: err.message, code: 'VALIDATION', issues: err.issues },
    }
  } else {
    return {
      status: 500,
      body: {
        message: err instanceof Error ? err.message : String(err),
        code: 'INTERNAL',
      },
    }
  }
}

function sendJson(ctx: Context, status: number, body: unknown): void {
  ctx.status = status
  ctx.type = 'application/json'
  ctx.body = body
}

export type CreateApiOptions = {
  config: BootstrapConfig
  db: DB
  blobs: BlobService
  config_store: ConfigStore
  thumbnails: ThumbnailService
}

export async function CreateApi({
  config,
  db,
  blobs,
  config_store,
  thumbnails,
}: CreateApiOptions) {
  const app = new Koa()
  const router = new Router()
  const actions = CreateActionRoute({ db, blobs, config_store })

  app.use(cors())

  const blob_router = CreateBlobRouter({
    config,
    blobs,
    get_max_upload_bytes: async () => (
      await config_store.getValue('sys.config.upload_max_bytes', value => z.number().parse(value))
    ) ?? 256 * 1024 * 1024,
  })
  app.use(blob_router.routes())
  app.use(blob_router.allowedMethods())
  const thumb_router = CreateThumbRouter({ thumbnails, blobs })
  app.use(thumb_router.routes())
  app.use(thumb_router.allowedMethods())

  app.use(bodyParser({ jsonLimit: '4mb' }))

  const handlers = {
    addItem: async payload => actions.addItem(zActionPayloads.addItem.parse(payload)),
    getItem: async payload => actions.getItem(zActionPayloads.getItem.parse(payload)),
    getItems: async payload => actions.getItems(zActionPayloads.getItems.parse(payload)),
    updateItem: async payload => actions.updateItem(zActionPayloads.updateItem.parse(payload)),
    deleteItem: async payload => actions.deleteItem(zActionPayloads.deleteItem.parse(payload)),
    listing: async payload => actions.listing(zActionPayloads.listing.parse(payload)),
    getItemByUnityName: async payload => actions.getItemByUnityName(
      zActionPayloads.getItemByUnityName.parse(payload),
    ),
    newTag: async payload => actions.newTag(zActionPayloads.newTag.parse(payload)),
    updateTag: async payload => actions.updateTag(zActionPayloads.updateTag.parse(payload)),
    deleteTag: async payload => actions.deleteTag(zActionPayloads.deleteTag.parse(payload)),
    searchTag: async payload => actions.searchTag(zActionPayloads.searchTag.parse(payload)),
    getTagByTitle: async payload => actions.getTagByTitle(zActionPayloads.getTagByTitle.parse(payload)),
    getConfig: async payload => {
      zActionPayloads.getConfig.parse(payload)
      return actions.getConfig()
    },
    updateConfig: async payload => actions.updateConfig(zActionPayloads.updateConfig.parse(payload)),
  } satisfies Record<ActionName, (payload: unknown) => Promise<unknown>>

  router.post('/action', async ctx => {
    try {
      const request = zActionRequest.parse(ctx.request.body)
      const action = __RPC_ACTION_NAMES__.find(each => each === request.action)
      if (action === undefined) {
        throw errorsBadRequest(`unknown ACTION: ${request.action}`)
      } else {
        const handler = handlers[action]
        const result = await handler(request.payload)
        sendJson(ctx, 200, result)
      }
    } catch (err) {
      const { status, body } = errorBody(err)
      if (status >= 500) {
        console.error('[action]', err)
      }
      sendJson(ctx, status, body)
    }
  })

  app.use(router.routes())
  app.use(router.allowedMethods())

  return app
}
