export type FileID = string & { __FILE_ID__: never }

function validFileNumber(file_number: number): string | null {
  if (!Number.isSafeInteger(file_number)) {
    return 'file_number 需要是合法的整数'
  } else if (file_number < 0) {
    return 'file_number 不能小于0'
  } else {
    return null
  }
}

export function name2number(name: string): number {
  if (typeof name !== 'string') {
    throw Error('name2number: 输入的并不是字符串')
  } else {
    const num = Number.parseInt(name)
    const valid = validFileNumber(num)
    if (valid !== null) {
      throw Error(valid)
    } else {
      return num
    }
  }
}

function isValidFileFormat(f: string) {
  if (f.length === 0) {
    return true
  } else {
    return /^[a-zA-Z0-9]+$/.test(f)
  }
}

export function constructFileID(num: number, format: string = ''): FileID {
  const num_valid = validFileNumber(num)
  if (num_valid !== null) {
    throw Error(num_valid)
  } else if (!isValidFileFormat(format)) {
    throw Error(`并不接受你所提供的format: ${format}`)
  } else {
    if (format.length) {
      return `${num}.${format}` as FileID
    } else {
      return `${num}` as FileID
    }
  }
}

export function parseFileID(fid: FileID): readonly [number, string | null] {
  const dot_idx = fid.indexOf('.')
  if (dot_idx === -1) {
    return [name2number(fid), null]
  } else {
    const num_part = fid.slice(0, dot_idx)
    const format = fid.slice(dot_idx + 1)
    if (!isValidFileFormat(format)) {
      throw Error(`非法的 FileID: ${fid}`)
    }
    return [name2number(num_part), format]
  }
}

export function isFileIDShape(value: unknown): value is FileID {
  return (
    (typeof value === 'string') &&
    /^\d+(\.[a-zA-Z0-9]+)?$/.test(value)
  )
}
