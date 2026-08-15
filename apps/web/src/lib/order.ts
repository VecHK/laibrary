export function orderAfter(cur: number, next: number | undefined): number {
  return next !== undefined ? (cur + next) / 2 : cur + 1
}

export type FieldSortState = {
  name: string
  type: 'string' | 'number'
  desc: boolean
} | null

export function cycleSortState(
  prev: FieldSortState,
  field_name: string,
  field_type: 'string' | 'number',
): FieldSortState {
  if (prev === null || prev.name !== field_name) {
    return { name: field_name, type: field_type, desc: false }
  } else if (!prev.desc) {
    return { name: field_name, type: field_type, desc: true }
  } else {
    return null
  }
}
