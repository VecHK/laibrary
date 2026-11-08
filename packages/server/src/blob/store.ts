import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createReadStream } from 'node:fs'
import sharp from 'sharp'
import type { BlobID } from '@laibrary/types'
import { storageError } from '../errors'

export type StoredBlob = {
  id: BlobID
  size: number
  mime: string
  width: number | null
  height: number | null
}

function normalizeDimensions(
  width: number | undefined,
  height: number | undefined,
  orientation: number | undefined,
): { width: number | null, height: number | null } {
  if (width === undefined || height === undefined) {
    return { width: null, height: null }
  }
  return ((orientation ?? 0) >= 5)
    ? { width: height, height: width }
    : { width, height }
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

async function fsyncFile(file_path: string): Promise<void> {
  try {
    const handle = await fs.promises.open(file_path, 'r')
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
  } catch {
    // Best effort: some platforms/filesystems do not allow fsync on a read handle.
  }
}

async function fsyncDirectory(dir_path: string): Promise<void> {
  try {
    const handle = await fs.promises.open(dir_path, 'r')
    try {
      await handle.sync()
    } finally {
      await handle.close()
    }
  } catch {
    // Best effort.
  }
}

export class BlobStore {
  readonly root: string

  constructor(root: string) {
    this.root = root
  }

  async init(): Promise<void> {
    await fs.promises.mkdir(this.root, { recursive: true })
    // 清理上次进程崩溃留下的临时文件；正常上传文件在 commit 后 rename 走。
    const entries = await fs.promises.readdir(this.root, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isFile() && entry.name.startsWith('.tmp-')) {
        await fs.promises.unlink(path.join(this.root, entry.name)).catch(() => undefined)
      }
    }
  }

  idFromHash(hash: string): BlobID {
    return hash as BlobID
  }

  pathFor(id: BlobID): string {
    return path.join(this.root, id.slice(0, 2), id.slice(2, 4), id)
  }

  async exists(id: BlobID): Promise<boolean> {
    try {
      const stat = await fs.promises.stat(this.pathFor(id))
      return stat.isFile()
    } catch {
      return false
    }
  }

  async stat(id: BlobID): Promise<fs.Stats> {
    return fs.promises.stat(this.pathFor(id))
  }

  async delete(id: BlobID): Promise<void> {
    try {
      await fs.promises.unlink(this.pathFor(id))
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
    }
  }

  private async inspect(file_path: string, mime: string): Promise<{
    width: number | null
    height: number | null
  }> {
    try {
      const meta = await sharp(file_path).metadata()
      return normalizeDimensions(meta.width, meta.height, meta.orientation)
    } catch (err) {
      if (mime.startsWith('image/')) {
        throw storageError('无法读取图片元数据', err)
      }
      return { width: null, height: null }
    }
  }

  private async commitTemp(
    temp_path: string,
    id: BlobID,
    metadata: { width: number | null, height: number | null },
  ): Promise<StoredBlob> {
    const final_path = this.pathFor(id)
    await fs.promises.mkdir(path.dirname(final_path), { recursive: true })

    if (await this.exists(id)) {
      await fs.promises.unlink(temp_path).catch(() => undefined)
      return {
        id,
        size: (await fs.promises.stat(final_path)).size,
        mime: '',
        width: metadata.width,
        height: metadata.height,
      }
    }

    await fsyncFile(temp_path)
    try {
      await fs.promises.rename(temp_path, final_path)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EXDEV') throw err
      await fs.promises.copyFile(temp_path, final_path)
      await fsyncFile(final_path)
      await fs.promises.unlink(temp_path).catch(() => undefined)
    }
    await fsyncDirectory(path.dirname(final_path))
    const stat = await fs.promises.stat(final_path)
    return {
      id,
      size: stat.size,
      mime: '',
      width: metadata.width,
      height: metadata.height,
    }
  }

  async putFile(temp_path: string, mime: string): Promise<StoredBlob> {
    try {
      const id = this.idFromHash(await sha256File(temp_path))
      const metadata = await this.inspect(temp_path, mime)
      const stored = await this.commitTemp(temp_path, id, metadata)
      return { ...stored, mime }
    } catch (err) {
      await fs.promises.unlink(temp_path).catch(() => undefined)
      if (err instanceof Error && err.name === 'AppError') throw err
      throw storageError('写入 blob 失败', err)
    }
  }

  async putBuffer(buf: Buffer, mime: string): Promise<StoredBlob> {
    const id = this.idFromHash(crypto.createHash('sha256').update(buf).digest('hex'))
    const temp_path = path.join(this.root, `.tmp-${crypto.randomUUID()}`)
    await fs.promises.mkdir(this.root, { recursive: true })
    await fs.promises.writeFile(temp_path, buf)

    try {
      const final_path = this.pathFor(id)
      if (await this.exists(id)) {
        await fs.promises.unlink(temp_path).catch(() => undefined)
        const stat = await fs.promises.stat(final_path)
        const meta = await this.inspect(final_path, mime)
        return { id, size: stat.size, mime, ...meta }
      }
      let metadata: { width: number | null, height: number | null } = { width: null, height: null }
      if (mime.startsWith('image/')) {
        const meta = await sharp(buf).metadata()
        metadata = normalizeDimensions(meta.width, meta.height, meta.orientation)
      }
      const stored = await this.commitTemp(temp_path, id, metadata)
      return { ...stored, mime }
    } catch (err) {
      await fs.promises.unlink(temp_path).catch(() => undefined)
      if (err instanceof Error && err.name === 'AppError') throw err
      throw storageError('写入 blob 失败', err)
    }
  }
}
