import type { FileID } from './FileID'

function normalizeBaseUrl(base_url: string): string {
  return base_url.replace(/\/+$/, '')
}

export function createFileUrl(base_url: string, fid: FileID): string {
  return `${normalizeBaseUrl(base_url)}/readfile/${fid}`
}

export async function uploadFile(
  base_url: string,
  file: Blob,
  filename: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<FileID> {
  const form_data = new FormData()
  form_data.append('file', file, filename)

  const res = await fetcher(
    `${normalizeBaseUrl(base_url)}/file`,
    { method: 'POST', body: form_data },
  )

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

  if (typeof body !== 'string') {
    throw new Error('上传响应并不是 FileID')
  }
  return body as FileID
}
