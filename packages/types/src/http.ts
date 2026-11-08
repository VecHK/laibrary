import type { BlobID, BlobMeta, ThumbSize } from './roles'

function normalizeBaseUrl(base_url: string): string {
  return base_url.replace(/\/+$/, '')
}

export function createBlobUrl(base_url: string, blob_id: BlobID): string {
  return `${normalizeBaseUrl(base_url)}/blob/${blob_id}`
}

export function createThumbUrl(
  base_url: string,
  image_id: number,
  size: ThumbSize,
): string {
  return `${normalizeBaseUrl(base_url)}/thumb/${image_id}?size=${size}`
}

export async function uploadBlob(
  base_url: string,
  file: Blob,
  filename: string,
  fetcher: typeof fetch = globalThis.fetch,
): Promise<{ blob: BlobMeta; reused: boolean }> {
  const form_data = new FormData()
  form_data.append('file', file, filename)

  const res = await fetcher(
    `${normalizeBaseUrl(base_url)}/blob`,
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

  if (
    body === null ||
    typeof body !== 'object' ||
    !('blob' in body)
  ) {
    throw new Error('上传响应并不是 BlobMeta')
  }

  const payload = body as { blob: BlobMeta; reused?: boolean }
  return { blob: payload.blob, reused: payload.reused === true }
}
