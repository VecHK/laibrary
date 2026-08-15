import { createRpcClient, RpcClient } from '@laibrary/types'

export type { RpcClient }

let __rpc__: RpcClient | null = null

export function createRpc(base_url: string): RpcClient {
  return createRpcClient(base_url)
}

export function setRpc(client: RpcClient | null): void {
  __rpc__ = client
}

export function getRpc(): RpcClient {
  if (__rpc__ === null) {
    throw new Error('尚未连接服务端')
  }
  return __rpc__
}
