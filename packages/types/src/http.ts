import type { BlobID, BlobMeta } from './roles'
import type { ThumbSize } from './constants'
import { zBlobUploadResponse, zErrorBody } from './schemas'

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

export type UploadBlobOptions = {
  base_url: string
  file: Blob
  filename: string
  fetcher?: typeof fetch | undefined
}

export async function uploadBlob({
  base_url,
  file,
  filename,
  fetcher = globalThis.fetch,
}: UploadBlobOptions): Promise<{ blob: BlobMeta; reused: boolean }> {
  const form_data = new FormData()
  form_data.append('file', file, filename)

  const res = await fetcher(
    `${normalizeBaseUrl(base_url)}/blob`,
    { method: 'POST', body: form_data },
  )

  const text = await res.text()
  const parsed_body: unknown = (() => {
    try {
      return JSON.parse(text)
    } catch {
      return null
    }
  })()

  if (!res.ok) {
    const parsed_error = zErrorBody.safeParse(parsed_body)
    if (parsed_error.success) {
      throw new Error(parsed_error.data.message)
    } else {
      throw new Error(`HTTP ${res.status}`)
    }
  } else {
    const payload = zBlobUploadResponse.parse(parsed_body)
    return { blob: payload.blob, reused: payload.reused }
  }
}
