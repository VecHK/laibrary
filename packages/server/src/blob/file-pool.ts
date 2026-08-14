import fs from 'fs'
import path from 'path'
import { Sequence } from 'vait'
import { FileID, parseFileID } from '@laibrary/types'
import pathExists, { checkDirectory, initDirectory, prepareWriteDirectory } from '../utils/directory'

export const __FILE_POOL_SPLIT_INTERVAL__ = 2000

export function splitPoint(
  interval: number,
  file_number: number,
): number {
  return Math.floor(file_number / interval) * interval
}

export function getFileBasePath(interval: number, f_id: FileID): string {
  const [f_num] = parseFileID(f_id)
  return path.join(`${splitPoint(interval, f_num)}`, f_id)
}

export type BlobFile = {
  file_id: FileID
  path: string
  mtime_ms: number
}

export type FilePool = {
  requestFileNumber(): Promise<number>
  filepool_path: string
  interval: number
  fileBasePath(f_id: FileID): string
  getFilePath(f_id: FileID): string
  fileExists(f_id: FileID): Promise<boolean>
  saveFile(f_id: FileID, buf: Buffer): Promise<void>
  loadFile(f_id: FileID): Promise<Buffer>
  deleteFile(f_id: FileID): Promise<void>
  collectBlobFiles(): Promise<BlobFile[]>
}

const __LATEST_FILENUMBER_SAVE_PATH = 'latest.json'

const saving = Sequence()

function saveLatestFileNumber(
  latest_num_path: string,
  file_number: number,
): Promise<void> {
  return saving(() => {
    return fs.promises.writeFile(
      latest_num_path,
      `${file_number}`,
      { encoding: 'utf-8' },
    )
  })
}

async function LatestFileNumber(filepool_path: string) {
  const latest_num_path = path.join(
    filepool_path, __LATEST_FILENUMBER_SAVE_PATH,
  )

  let latest = 0

  if (false === (await pathExists(latest_num_path))) {
    await saveLatestFileNumber(latest_num_path, 0)
  } else {
    latest = Number.parseInt(
      await fs.promises.readFile(latest_num_path, 'utf-8'),
    )
  }

  return async function requestFileNumber(): Promise<number> {
    const new_num = latest + 1
    latest = new_num
    await saveLatestFileNumber(latest_num_path, new_num)
    return new_num
  }
}

async function collectDirectoryFileRecursive(dir: string): Promise<string[]> {
  const res = await checkDirectory(dir)
  if (res === 'dir') {
    const files = await fs.promises.readdir(dir)
    let file_list: string[] = []
    for (const file of files) {
      file_list = [
        ...file_list,
        ...await collectDirectoryFileRecursive(path.join(dir, file)),
      ]
    }
    return file_list
  } else if (res === 'is_not_dir') {
    return [dir]
  } else {
    return []
  }
}

export async function initFilePool(
  filepool_path: string,
  interval: number = __FILE_POOL_SPLIT_INTERVAL__,
): Promise<FilePool> {
  await initDirectory(filepool_path)

  const filePath = (f_id: FileID): string => {
    return path.join(filepool_path, getFileBasePath(interval, f_id))
  }

  return {
    requestFileNumber: await LatestFileNumber(filepool_path),
    filepool_path,
    interval,
    fileBasePath: (f_id: FileID) => getFileBasePath(interval, f_id),
    getFilePath: filePath,
    fileExists: async (f_id: FileID) => {
      const p = filePath(f_id)
      const status = await checkDirectory(p)
      return status === 'is_not_dir'
    },
    async saveFile(f_id: FileID, buf: Buffer) {
      const write_path = filePath(f_id)
      await prepareWriteDirectory(write_path)
      await fs.promises.writeFile(write_path, buf)
    },
    async loadFile(f_id: FileID) {
      return fs.promises.readFile(filePath(f_id))
    },
    async deleteFile(f_id: FileID) {
      const p = filePath(f_id)
      if (await pathExists(p)) {
        await fs.promises.unlink(p)
      }
    },
    async collectBlobFiles() {
      const blobs: BlobFile[] = []
      const splits = await fs.promises.readdir(filepool_path)
      for (const split of splits) {
        if (split === __LATEST_FILENUMBER_SAVE_PATH) {
          continue
        }
        const split_path = path.join(filepool_path, split)
        if ('dir' === (await checkDirectory(split_path))) {
          const file_path_list = await collectDirectoryFileRecursive(split_path)
          for (const file_path of file_path_list) {
            const stat = await fs.promises.stat(file_path)
            blobs.push({
              file_id: path.basename(file_path) as FileID,
              path: file_path,
              mtime_ms: stat.mtimeMs,
            })
          }
        }
      }
      return blobs
    },
  }
}
