import type { Item } from '@laibrary/types'

/** 容器块的副本语义不明确：page/database 不复制为普通 block。 */
export function blockCanDuplicate(item: Item): boolean {
  return item.role !== 'page' && item.role !== 'database'
}

/** 通用 deleteItem 没有级联；容器块先不开放删除，避免孤儿数据。 */
export function blockCanDelete(item: Item): boolean {
  return item.role !== 'page' && item.role !== 'database'
}
