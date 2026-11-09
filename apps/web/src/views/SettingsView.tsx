import { useEffect, useState } from 'react'
import type { ConfigEntry } from '@laibrary/types'
import { getRpc } from '../lib/rpc'
import { getBaseUrl, clearBaseUrl } from '../lib/settings'
import type { ViewerCtx } from '../modules/types'

function displayValue(entry: ConfigEntry): string {
  if (entry.type === 'json') {return JSON.stringify(entry.value, null, 2)}
  return String(entry.value)
}

function parseValue(entry: ConfigEntry, raw: string): unknown {
  if (entry.type === 'number') {
    const value = Number(raw)
    if (!Number.isFinite(value)) {throw new Error('需要数字')}
    return value
  }
  if (entry.type === 'boolean') {
    if (raw === 'true') {return true}
    if (raw === 'false') {return false}
    throw new Error('需要 true / false')
  }
  if (entry.type === 'json') {return JSON.parse(raw) as unknown}
  return raw
}

export function SettingsView({ ctx }: { ctx: ViewerCtx }) {
  const [entries, setEntries] = useState<ConfigEntry[] | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [version, setVersion] = useState(1)
  const [saving, setSaving] = useState<string | null>(null)

  const load = () => {
    getRpc().getConfig(undefined).then(snapshot => {
      setEntries(snapshot.entries)
      setVersion(snapshot.version)
      setDrafts(Object.fromEntries(snapshot.entries.map(entry => [entry.key, displayValue(entry)])))
    }).catch(err => ctx.showError(err instanceof Error ? err.message : String(err)))
  }

  useEffect(load, [])

  const save = (entry: ConfigEntry) => {
    const raw = drafts[entry.key] ?? ''
    setSaving(entry.key)
    try {
      const value = parseValue(entry, raw)
      getRpc().updateConfig({ key: entry.key, value })
        .then(() => {
          ctx.refresh()
          load()
        })
        .catch(err => ctx.showError(err instanceof Error ? err.message : String(err)))
        .finally(() => setSaving(null))
    } catch (err) {
      ctx.showError(err instanceof Error ? err.message : String(err))
      setSaving(null)
    }
  }

  return (
    <div className="settings-view">
      <div className="panel">
        <div className="panel-title">系统设置</div>
        <p className="settings-note">
          这些设置来自 <code>sys.config</code> database 的 Item，修改后立即生效。
          连接地址、端口、存储路径等 bootstrap 配置来自根目录 <code>.env</code>，需要重启。
        </p>
        <div className="meta-row">
          <span>配置版本: {version}</span>
          <span>服务地址: {getBaseUrl() ?? '(未连接)'}</span>
          <button
            className="button"
            onClick={() => {
              clearBaseUrl()
              window.location.reload()
            }}
          >更改连接地址</button>
        </div>
      </div>

      {entries === null ? (
        <div className="loading">加载中…</div>
      ) : (
        <div className="settings-list">
          {entries.map(entry => (
            <div className="settings-row" key={entry.key}>
              <div className="settings-label">
                <div className="settings-title">{entry.title}</div>
                <code className="settings-key">{entry.key}</code>
              </div>
              <div className="settings-control">
                {entry.type === 'boolean' ? (
                  <select
                    value={drafts[entry.key] ?? 'false'}
                    onChange={ev => setDrafts(prev => ({ ...prev, [entry.key]: ev.target.value }))}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : entry.type === 'json' ? (
                  <textarea
                    className="settings-input settings-json"
                    value={drafts[entry.key] ?? ''}
                    onChange={ev => setDrafts(prev => ({ ...prev, [entry.key]: ev.target.value }))}
                  />
                ) : (
                  <input
                    className="settings-input"
                    value={drafts[entry.key] ?? ''}
                    onChange={ev => setDrafts(prev => ({ ...prev, [entry.key]: ev.target.value }))}
                  />
                )}
                <button
                  className="button"
                  disabled={saving === entry.key}
                  onClick={() => save(entry)}
                >
                  {saving === entry.key ? '保存中…' : '保存'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
