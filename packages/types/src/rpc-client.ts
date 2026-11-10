import type { ActionTable } from './rpc'
import type { BlobID, ConfigSnapshot, Item } from './roles'
import {
  zConfigSnapshot, zErrorBody, zItem, zItems, zMessage,
} from './schemas'

export type ActionName = keyof ActionTable
export type ActionPayload<N extends ActionName> = Parameters<ActionTable[N]>[0]
export type ActionResult<N extends ActionName> = Awaited<ReturnType<ActionTable[N]>>

export type RpcClient = ActionTable

export type RpcErrorOptions = {
  status: number
  code: string
  cause?: unknown
}

export class RpcError extends Error {
  readonly status: number
  readonly code: string

  constructor(message: string, options: RpcErrorOptions) {
    super(message, { cause: options.cause })
    this.name = 'RpcError'
    this.status = options.status
    this.code = options.code
  }
}

export type CreateRpcClientOptions = {
  base_url: string
  fetcher?: typeof fetch
}

function normalizeBaseUrl(base_url: string): string {
  return base_url.replace(/\/+$/, '')
}

export function CreateRpcClient({
  base_url,
  fetcher = globalThis.fetch,
}: CreateRpcClientOptions): RpcClient {
  const request = async (action: string, payload: unknown): Promise<unknown> => {
    const response = await fetcher(`${normalizeBaseUrl(base_url)}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    })

    const text = await response.text()
    const parsed_body: unknown = (() => {
      try {
        return JSON.parse(text)
      } catch {
        return null
      }
    })()

    if (!response.ok) {
      const parsed_error = zErrorBody.safeParse(parsed_body)
      if (parsed_error.success) {
        throw new RpcError(parsed_error.data.message, {
          status: response.status,
          code: parsed_error.data.code,
        })
      } else {
        throw new RpcError(`HTTP ${response.status}`, {
          status: response.status,
          code: 'HTTP_ERROR',
        })
      }
    }

    return parsed_body
  }

  return {
    addItem: async form => zItem.parse(await request('addItem', form)),
    getItem: async payload => zItem.parse(await request('getItem', payload)),
    getItems: async ids => zItems.parse(await request('getItems', ids)),
    updateItem: async payload => zMessage.parse(await request('updateItem', payload)),
    deleteItem: async payload => zMessage.parse(await request('deleteItem', payload)),
    deleteItems: async ids => zItems.parse(await request('deleteItems', ids)),
    restoreItems: async items => zItems.parse(await request('restoreItems', items)),
    convertTextBlock: async payload => zItem.parse(await request('convertTextBlock', payload)),
    listing: async payload => zItems.parse(await request('listing', payload)),
    getItemByUnityName: async payload => zItem.nullable().parse(
      await request('getItemByUnityName', payload),
    ),
    newTag: async payload => zItem.parse(await request('newTag', payload)),
    updateTag: async payload => zMessage.parse(await request('updateTag', payload)),
    deleteTag: async payload => zMessage.parse(await request('deleteTag', payload)),
    searchTag: async payload => zItems.parse(await request('searchTag', payload)),
    getTagByTitle: async payload => zItem.nullable().parse(
      await request('getTagByTitle', payload),
    ),
    getConfig: async () => zConfigSnapshot.parse(await request('getConfig', undefined)),
    updateConfig: async payload => zMessage.parse(await request('updateConfig', payload)),
  }
}

export type { BlobID, ConfigSnapshot, Item }
