import fs from 'node:fs'
import path from 'node:path'
import { access, mkdir, stat } from 'node:fs/promises'

export type CheckDirectoryResult = 'notfound' | 'dir' | 'is_not_dir'

function isErrno(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error
}

export async function directoryPathExists(filepath: string): Promise<boolean> {
  try {
    await access(filepath)
    return true
  } catch (error) {
    if (isErrno(error) && error.code === 'ENOENT') {
      return false
    } else {
      throw error
    }
  }
}

export async function directoryCheck(dir_path: string): Promise<CheckDirectoryResult> {
  if (await directoryPathExists(dir_path)) {
    if ((await stat(dir_path)).isDirectory()) {
      return 'dir'
    } else {
      return 'is_not_dir'
    }
  } else {
    return 'notfound'
  }
}

export async function directoryInit(dir_path: string): Promise<void> {
  const checked = await directoryCheck(dir_path)
  if (checked === 'notfound') {
    await mkdir(dir_path, { recursive: true })
  } else if (checked === 'is_not_dir') {
    throw new Error(`路径[${dir_path}]不是一个目录`)
  }
}

export function directoryPrepareWrite(write_path: string): Promise<void> {
  return directoryInit(path.dirname(write_path))
}

export function directoryInitSync(dir_path: string): void {
  if (!fs.existsSync(dir_path)) {
    fs.mkdirSync(dir_path, { recursive: true })
  } else {
    const s = fs.statSync(dir_path)
    if (!s.isDirectory()) {
      throw new Error(`路径[${dir_path}]不是一个目录`)
    }
  }
}
