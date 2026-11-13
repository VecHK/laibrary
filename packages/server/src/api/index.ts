import type { HttpBindings } from '@hono/node-server'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { cors } from 'hono/cors'
import { methodNotAllowed } from 'hono/method-not-allowed'
import { z, ZodError } from 'zod'
import type { ActionName } from '@laibrary/types'
import { RPC_ACTION_NAMES, zActionPayloads } from '@laibrary/types'
import type { BootstrapConfig } from '../config/bootstrap'
import type { DB } from '../db/client'
import type { BlobService } from '../blob/service'
import type { ConfigStore } from '../config/store'
import type { ThumbnailService } from '../thumbnails/service'
import { errorsIsAppError, errorsBadRequest } from '../errors'
import { CreateActionRoute } from './actions'
import { CreateBlobRouter } from './blob-routes'
import { CreateThumbRouter } from './thumb-routes'

const ACTION_BODY_LIMIT_BYTES = 4 * 1024 * 1024

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

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

export type ApiApp = Hono<{ Bindings: HttpBindings }>

export type CreateApiOptions = {
  config: BootstrapConfig
  db: DB
  blobs: BlobService
  config_store: ConfigStore
  thumbnails: ThumbnailService
}

export async function CreateApi({
  config: _config,
  db: _db,
  blobs: _blobs,
  config_store: _config_store,
  thumbnails: _thumbnails,
}: CreateApiOptions): Promise<ApiApp> {
  const app = new Hono<{ Bindings: HttpBindings }>()
  const actions = CreateActionRoute({ db: _db, blobs: _blobs, config_store: _config_store })

  app.use('*', cors())

  const blob_app = CreateBlobRouter({
    config: _config,
    blobs: _blobs,
    get_max_upload_bytes: async () => (
      await _config_store.getValue('sys.config.upload_max_bytes', value => z.number().parse(value))
    ) ?? 256 * 1024 * 1024,
  })
  app.route('/', blob_app)

  const thumb_app = CreateThumbRouter({ thumbnails: _thumbnails, blobs: _blobs })
  app.route('/', thumb_app)

  const handlers = {
    addItem: async payload => actions.addItem(zActionPayloads.addItem.parse(payload)),
    getItem: async payload => actions.getItem(zActionPayloads.getItem.parse(payload)),
    getItems: async payload => actions.getItems(zActionPayloads.getItems.parse(payload)),
    updateItem: async payload => actions.updateItem(zActionPayloads.updateItem.parse(payload)),
    deleteItem: async payload => actions.deleteItem(zActionPayloads.deleteItem.parse(payload)),
    deleteItems: async payload => actions.deleteItems(zActionPayloads.deleteItems.parse(payload)),
    restoreItems: async payload => actions.restoreItems(zActionPayloads.restoreItems.parse(payload)),
    convertTextBlock: async payload => actions.convertTextBlock(
      zActionPayloads.convertTextBlock.parse(payload),
    ),
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

  app.post(
    '/action',
    bodyLimit({
      maxSize: ACTION_BODY_LIMIT_BYTES,
      onError: c => c.json({ message: '请求体超过上限', code: 'PAYLOAD_TOO_LARGE' }, 413),
    }),
    async c => {
      const raw_body = await c.req.json<unknown>().catch(() => {
        throw errorsBadRequest('请求体不是合法 JSON')
      })
      const request = zActionRequest.parse(raw_body)
      const action = RPC_ACTION_NAMES.find(each => each === request.action)
      if (action === undefined) {
        throw errorsBadRequest(`unknown ACTION: ${request.action}`)
      } else {
        const handler = handlers[action]
        const result = await handler(request.payload)
        return c.json(result, 200)
      }
    },
  )

  app.use(methodNotAllowed({
    app,
    onMethodNotAllowed: (c, methods) => c.json(
      { message: 'method not allowed', code: 'BAD_REQUEST' },
      405,
      { Allow: methods.join(', ') },
    ),
  }))

  app.onError(err => {
    const { status, body } = errorBody(err)
    if (status >= 500) {
      console.error('[api]', err)
    }
    return jsonResponse(status, body)
  })

  return app
}
