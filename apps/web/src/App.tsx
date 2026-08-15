import { useCallback, useEffect, useState } from 'react'
import { createRpc, setRpc } from './lib/rpc'
import { getBaseUrl, setBaseUrl } from './lib/settings'
import { useHashRoute, type HashRoute } from './lib/hash-router'
import { loadTags } from './lib/tags'
import { ConnectScreen } from './views/ConnectScreen'
import { MainLayout } from './views/MainLayout'
import type { ViewerCtx } from './modules/types'

export default function App() {
  const [route, navigate] = useHashRoute()
  const [connected, setConnected] = useState(false)
  const [refresh_key, setRefreshKey] = useState(0)
  const [toast, setToast] = useState<string | null>(null)

  const showError = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 4000)
  }, [])

  const refresh = useCallback(() => {
    setRefreshKey(k => k + 1)
  }, [])

  const navigateTarget = useCallback((target: number | HashRoute) => {
    if (typeof target === 'number') {
      navigate({ name: 'item', id: target })
    } else {
      navigate(target)
    }
  }, [navigate])

  const ctx: ViewerCtx = { navigate: navigateTarget, refresh, showError }

  const connect = useCallback(async (base_url: string) => {
    setRpc(createRpc(base_url))
    setBaseUrl(base_url)
    await loadTags()
    setConnected(true)
  }, [])

  useEffect(() => {
    const saved = getBaseUrl()
    if (saved !== null) {
      (async () => {
        try {
          await connect(saved)
        } catch (err) {
          console.warn('自动连接失败', err)
          setConnected(false)
        }
      })()
    }
  }, [connect])

  return (
    <>
      {connected ? (
        <MainLayout
          route={route}
          ctx={ctx}
          refresh_key={refresh_key}
          onOpenSettings={() => {
            setConnected(false)
            navigate({ name: 'settings' })
          }}
        />
      ) : (
        <ConnectScreen onConnected={connect} />
      )}
      {toast !== null && <div className="toast">{toast}</div>}
    </>
  )
}
