import { useState } from 'react'
import { createRpc } from '../lib/rpc'

export function ConnectScreen({
  onConnected,
}: {
  onConnected: (base_url: string) => Promise<void>
}) {
  const [value, setValue] = useState(
    localStorage.getItem('laibrary.baseurl') ?? 'http://127.0.0.1:44998',
  )
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const testConnection = async () => {
    setTesting(true)
    setError(null)
    try {
      const client = createRpc(value)
      await client.listing({ limit: 1 })
      await onConnected(value)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="connect-screen">
      <div className="connect-box">
        <h1>Laibrary</h1>
        <p>输入后端服务地址(NAS 上运行的服务端)</p>
        <input
          className="big-input"
          value={value}
          placeholder="http://192.168.1.2:44998"
          onChange={ev => setValue(ev.target.value)}
          onKeyDown={ev => {
            if (ev.key === 'Enter') {
              testConnection()
            }
          }}
        />
        <button className="button primary" disabled={testing} onClick={testConnection}>
          {testing ? '测试中…' : '连接'}
        </button>
        {error !== null && <div className="error-text">{error}</div>}
      </div>
    </div>
  )
}
