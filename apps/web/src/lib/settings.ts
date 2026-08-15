const __SETTINGS_KEY__ = 'laibrary.baseurl'

export function getBaseUrl(): string | null {
  return localStorage.getItem(__SETTINGS_KEY__)
}

export function setBaseUrl(base_url: string): void {
  localStorage.setItem(__SETTINGS_KEY__, base_url.replace(/\/+$/, ''))
}

export function clearBaseUrl(): void {
  localStorage.removeItem(__SETTINGS_KEY__)
}
