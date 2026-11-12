import type { Item } from '@laibrary/types'

/** 侧边栏节点是否可以在内部新增内容。 */
export function treeCanAddInside(item: Item, target: Item | undefined): boolean {
  if (item.role === 'page' || item.role === 'database') {
    return true
  } else if (item.role === 'itemlink') {
    return target?.role === 'page'
  } else {
    return false
  }
}
