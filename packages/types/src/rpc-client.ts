import type { ActionTable } from './rpc'

export type ActionName = keyof ActionTable
export type ActionPayload<N extends ActionName> = Parameters<ActionTable[N]>[0]
export type ActionResult<N extends ActionName> = Awaited<ReturnType<ActionTable[N]>>

export interface RpcClient {
  call<N extends ActionName>(action: N, payload: ActionPayload<N>): Promise<ActionResult<N>>
  request(action: string, payload: unknown): Promise<unknown>
}

export function createRpcClient(
  base_url: string,
  fetcher: typeof fetch = globalThis.fetch,
): RpcClient {
  const request = async (action: string, payload: unknown): Promise<unknown> => {
    const res = await fetcher(`${base_url}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, payload }),
    })

    const text = await res.text()
    let body: unknown = null
    try {
      body = JSON.parse(text)
    } catch {
      body = null
    }

    if (!res.ok) {
      const message = (
        (body !== null) &&
        (typeof body === 'object') &&
        ('message' in body)
      ) ? String(body.message) : `HTTP ${res.status}`
      throw new Error(message)
    }

    return body
  }

  return {
    call: (action, payload) => {
      return request(action, payload) as Promise<ActionResult<typeof action>>
    },
    request,
  }
}
