import fs from 'fs'
import path from 'path'
import { access, mkdir, stat } from 'node:fs/promises'

export default async function pathExists(filepath: string): Promise<boolean> {
  try {
    await access(filepath)
    return true
  } catch {
    return false
  }
}

export type CheckDirectoryResult = 'notfound' | 'dir' | 'is_not_dir'

export async function checkDirectory(
  dir_path: string,
): Promise<CheckDirectoryResult> {
  if (await pathExists(dir_path)) {
    if ((await stat(dir_path)).isDirectory()) {
      return 'dir'
    } else {
      return 'is_not_dir'
    }
  } else {
    return 'notfound'
  }
}

export async function initDirectory(dir_path: string): Promise<void> {
  switch (await checkDirectory(dir_path)) {
    case 'dir':
      break
    case 'notfound':
      await mkdir(dir_path, { recursive: true })
      break
    case 'is_not_dir':
      throw Error(`路径[${dir_path}]不是一个目录`)
  }
}

export function prepareWriteDirectory(write_path: string): Promise<void> {
  return initDirectory(path.dirname(write_path))
}

export function initDirectorySync(dir_path: string): void {
  if (!fs.existsSync(dir_path)) {
    fs.mkdirSync(dir_path, { recursive: true })
  } else {
    const s = fs.statSync(dir_path)
    if (!s.isDirectory()) {
      throw Error(`路径[${dir_path}]不是一个目录`)
    }
  }
}
