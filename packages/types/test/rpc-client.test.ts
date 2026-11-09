import { describe, expect, it } from 'vitest'
import { CreateRpcClient, type RpcError } from '../src/rpc-client'

const item = {
  id: 1,
  role: 'page',
  kind: null,
  unity_name: null,
  title: 'x',
  attributes: {},
  tags: [],
  parent_id: null,
  order_index: 1,
  blob: null,
  target_id: null,
  create_date: '2026-01-01T00:00:00.000Z',
  update_date: '2026-01-01T00:00:00.000Z',
}

function response(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('CreateRpcClient', () => {
  it('parses Item responses', async () => {
    const client = CreateRpcClient({
      base_url: 'http://example.test',
      fetcher: async () => response(item),
    })
    const got = await client.getItem({ id: 1 })
    expect(got.title).toBe('x')
    expect(got.id).toBe(1)
  })

  it('throws RpcError with server code', async () => {
    const client = CreateRpcClient({
      base_url: 'http://example.test',
      fetcher: async () => response({ message: 'no', code: 'NOT_FOUND' }, 404),
    })
    await expect(client.getItem({ id: 1 })).rejects.toMatchObject({
      name: 'RpcError',
      code: 'NOT_FOUND',
      status: 404,
    } satisfies Partial<RpcError>)
  })
})
