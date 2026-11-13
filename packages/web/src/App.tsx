import { useCallback, useEffect, useRef, useState } from 'react'
import type { RpcClient } from '@laibrary/types'
import { CreateRpcClient } from '@laibrary/types'
import {
  settingsGetBaseUrl, settingsParseBaseUrl, settingsSetBaseUrl,
} from './lib/settings'
import { useHashRoute, type HashRoute } from './lib/hash-router'
import {
  CreateTagStore, useTagStoreVersion, type TagStore,
} from './lib/tags'
import { CreateModuleRegistry } from './modules/registry'
import { ConnectScreen } from './views/ConnectScreen'
import { MainLayout } from './views/MainLayout'
import type { ItemModuleRegistry, ViewerCtx } from './modules/types'
import type { ItemID } from '@laibrary/types'

type Session = {
  readonly base_url: string
  readonly rpc: RpcClient
  readonly tags: TagStore
  readonly modules: ItemModuleRegistry
}

export default function App() {
  const [route, navigate] = useHashRoute()
  const [session, setSession] = useState<Session | null>(null)
  const [refresh_key, setRefreshKey] = useState(0)
  const [sidebar_key, setSidebarKey] = useState(0)
  const [toast, setToast] = useState<string | null>(null)
  const toast_timer_ref = useRef<ReturnType<typeof setTimeout> | null>(null)

  useTagStoreVersion(session?.tags ?? null)

  useEffect(() => () => {
    if (toast_timer_ref.current !== null) {
      clearTimeout(toast_timer_ref.current)
    }
  }, [])

  const showError = useCallback((message: string) => {
    if (toast_timer_ref.current !== null) {
      clearTimeout(toast_timer_ref.current)
    }
    setToast(message)
    toast_timer_ref.current = setTimeout(() => {
      setToast(null)
      toast_timer_ref.current = null
    }, 4000)
  }, [])

  const showNotice = showError

  const refreshSidebar = useCallback(() => {
    setSidebarKey(current => current + 1)
  }, [])

  const refresh = useCallback(() => {
    setRefreshKey(current => current + 1)
    setSidebarKey(current => current + 1)
  }, [])

  const navigateTarget = useCallback((target: ItemID | HashRoute) => {
    if (typeof target === 'number') {
      navigate({ name: 'item', id: target })
    } else {
      navigate(target)
    }
  }, [navigate])

  const connect = useCallback(async (base_url: string) => {
    const parsed = settingsParseBaseUrl(base_url)
    if (parsed === null) {
      throw new Error('服务地址必须是 http/https URL')
    }
    const rpc = CreateRpcClient({ base_url: parsed })
    await rpc.listing({ limit: 1 })
    const tags = CreateTagStore({ rpc })
    await tags.load()
    settingsSetBaseUrl(parsed)
    setSession({
      base_url: parsed,
      rpc,
      tags,
      modules: CreateModuleRegistry(),
    })
  }, [])

  useEffect(() => {
    const saved = settingsGetBaseUrl()
    if (saved !== null) {
      void connect(saved).catch(error => {
        setSession(null)
        showError(error instanceof Error ? error.message : String(error))
      })
    }
  }, [connect, showError])

  const ctx: ViewerCtx | null = session === null
                                ? null
                                : {
                                    api: { base_url: session.base_url, rpc: session.rpc },
                                    tags: session.tags,
                                    modules: session.modules,
                                    navigate: navigateTarget,
                                    refresh,
                                    refreshSidebar,
                                    showError,
                                    showNotice,
                                  }

  return (
    <>
      {ctx === null ? (
        <ConnectScreen onConnected={connect} />
      ) : (
        <MainLayout
          route={route}
          ctx={ctx}
          refresh_key={refresh_key}
          sidebar_key={sidebar_key}
        />
      )}
      {toast !== null && <div className="toast">{toast}</div>}
    </>
  )
}
