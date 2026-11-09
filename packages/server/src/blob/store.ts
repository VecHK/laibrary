import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createReadStream } from 'node:fs'
import sharp from 'sharp'
import { as } from '@laibrary/types'
import type { BlobID } from '@laibrary/types'
import { errorsIsAppError, errorsStorage } from '../errors'

export type StoredBlob = {
  readonly id: BlobID
  readonly size: number
  readonly mime: string
  readonly width: number | null
  readonly height: number | null
}

export type BlobStore = {
  readonly root: string
  readonly init: () => Promise<void>
  readonly idFromHash: (hash: string) => BlobID
  readonly pathFor: (id: BlobID) => string
  readonly exists: (id: BlobID) => Promise<boolean>
  readonly stat: (id: BlobID) => Promise<fs.Stats>
  readonly delete: (id: BlobID) => Promise<void>
  readonly putFile: (temp_path: string, mime: string) => Promise<StoredBlob>
  readonly putBuffer: (buf: Buffer, mime: string) => Promise<StoredBlob>
}

export type CreateBlobStoreOptions = {
  root: string
  on_error: (error: unknown) => void
}

function isErrno(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

function normalizeDimensions(
  width: number | undefined,
  height: number | undefined,
  orientation: number | undefined,
): { width: number | null, height: number | null } {
  if (width === undefined || height === undefined) {
    return { width: null, height: null }
  } else {
    if ((orientation ?? 0) >= 5) {
      return { width: height, height: width }
    } else {
      return { width, height }
    }
  }
}

function sha256File(file_path: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = createReadStream(file_path)
    stream.on('data', chunk => hash.update(chunk))
    stream.on('error', reject)
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

async function fsyncFile(
  file_path: string,
  on_error: (error: unknown) => void,
): Promise<void> {
  try {
    const handle = await fs.promises.open(file_path, 'r')
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
  } catch (error) {
    on_error(error)
  }
}

async function fsyncDirectory(
  dir_path: string,
  on_error: (error: unknown) => void,
): Promise<void> {
  try {
    const handle = await fs.promises.open(dir_path, 'r')
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
  } catch (error) {
    on_error(error)
  }
}

async function removeIfExists(
  file_path: string,
  on_error: (error: unknown) => void,
): Promise<void> {
  try {
    await fs.promises.unlink(file_path)
  } catch (error) {
    if (!(isErrno(error) && error.code === 'ENOENT')) {
      on_error(error)
    }
  }
}

export function CreateBlobStore({
  root,
  on_error,
}: CreateBlobStoreOptions): BlobStore {
  const pathFor = (id: BlobID): string => path.join(root, id.slice(0, 2), id.slice(2, 4), id)

  const exists = async (id: BlobID): Promise<boolean> => {
    try {
      const stat = await fs.promises.stat(pathFor(id))
      return stat.isFile()
    } catch (error) {
      if (isErrno(error) && error.code === 'ENOENT') {
        return false
      } else {
        throw error
      }
    }
  }

  const inspect = async (
    file_path: string,
    mime: string,
  ): Promise<{ width: number | null, height: number | null }> => {
    if (!mime.startsWith('image/')) {
      return { width: null, height: null }
    } else {
      try {
        const meta = await sharp(file_path).metadata()
        return normalizeDimensions(meta.width, meta.height, meta.orientation)
      } catch (cause) {
        throw errorsStorage('无法读取图片元数据', cause)
      }
    }
  }

  const commitTemp = async (
    temp_path: string,
    id: BlobID,
    metadata: { width: number | null, height: number | null },
  ): Promise<StoredBlob> => {
    const final_path = pathFor(id)
    await fs.promises.mkdir(path.dirname(final_path), { recursive: true })

    if (await exists(id)) {
      await removeIfExists(temp_path, on_error)
      return {
        id,
        size: (await fs.promises.stat(final_path)).size,
        mime: '',
        width: metadata.width,
        height: metadata.height,
      }
    } else {
      await fsyncFile(temp_path, on_error)
      try {
        await fs.promises.rename(temp_path, final_path)
      } catch (error) {
        if (isErrno(error) && error.code === 'EXDEV') {
          await fs.promises.copyFile(temp_path, final_path)
          await fsyncFile(final_path, on_error)
          await removeIfExists(temp_path, on_error)
        } else {
          throw error
        }
      }
      await fsyncDirectory(path.dirname(final_path), on_error)
      const stat = await fs.promises.stat(final_path)
      return {
        id,
        size: stat.size,
        mime: '',
        width: metadata.width,
        height: metadata.height,
      }
    }
  }

  const init = async (): Promise<void> => {
    await fs.promises.mkdir(root, { recursive: true })
    const entries = await fs.promises.readdir(root, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && entry.name.startsWith('.tmp-')) {
        await removeIfExists(path.join(root, entry.name), on_error)
      }
    }
  }

  const putFile = async (temp_path: string, mime: string): Promise<StoredBlob> => {
    try {
      const id = as<BlobID>(await sha256File(temp_path))
      const metadata = await inspect(temp_path, mime)
      const stored = await commitTemp(temp_path, id, metadata)
      return { ...stored, mime }
    } catch (error) {
      await removeIfExists(temp_path, on_error)
      if (errorsIsAppError(error)) {
        throw error
      } else {
        throw errorsStorage('写入 blob 失败', error)
      }
    }
  }

  const putBuffer = async (buf: Buffer, mime: string): Promise<StoredBlob> => {
    const id = as<BlobID>(crypto.createHash('sha256').update(buf).digest('hex'))
    const temp_path = path.join(root, `.tmp-${crypto.randomUUID()}`)
    await fs.promises.mkdir(root, { recursive: true })
    await fs.promises.writeFile(temp_path, buf)

    try {
      const final_path = pathFor(id)
      if (await exists(id)) {
        await removeIfExists(temp_path, on_error)
        const stat = await fs.promises.stat(final_path)
        const meta = await inspect(final_path, mime)
        return { id, size: stat.size, mime, ...meta }
      } else {
        const metadata = mime.startsWith('image/')
                          ? await inspect(temp_path, mime)
                          : { width: null, height: null }
        const stored = await commitTemp(temp_path, id, metadata)
        return { ...stored, mime }
      }
    } catch (error) {
      await removeIfExists(temp_path, on_error)
      if (errorsIsAppError(error)) {
        throw error
      } else {
        throw errorsStorage('写入 blob 失败', error)
      }
    }
  }

  return {
    root,
    init,
    idFromHash: hash => as<BlobID>(hash),
    pathFor,
    exists,
    stat: id => fs.promises.stat(pathFor(id)),
    delete: async id => {
      try {
        await fs.promises.unlink(pathFor(id))
      } catch (error) {
        if (!(isErrno(error) && error.code === 'ENOENT')) {
          throw error
        }
      }
    },
    putFile,
    putBuffer,
  }
}
