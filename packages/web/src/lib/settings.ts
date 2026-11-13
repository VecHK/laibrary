const SETTINGS_BASE_URL_KEY = 'laibrary.baseurl'

export function settingsNormalizeBaseUrl(base_url: string): string {
  return base_url.trim().replace(/\/+$/, '')
}

export function settingsParseBaseUrl(raw: string): string | null {
  try {
    const url = new URL(settingsNormalizeBaseUrl(raw))
    if (url.protocol === 'http:' || url.protocol === 'https:') {
      return url.toString().replace(/\/+$/, '')
    } else {
      return null
    }
  } catch {
    return null
  }
}

export function settingsGetBaseUrl(): string | null {
  const raw = localStorage.getItem(SETTINGS_BASE_URL_KEY)
  return raw === null ? null : settingsParseBaseUrl(raw)
}

export function settingsSetBaseUrl(base_url: string): void {
  const parsed = settingsParseBaseUrl(base_url)
  if (parsed === null) {
    throw new Error('服务地址必须是 http/https URL')
  } else {
    localStorage.setItem(SETTINGS_BASE_URL_KEY, parsed)
  }
}

export function settingsClearBaseUrl(): void {
  localStorage.removeItem(SETTINGS_BASE_URL_KEY)
}
