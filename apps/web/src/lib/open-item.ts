import type { Item, ItemID } from '@laibrary/types'
import { getRpc } from './rpc'
import { getKindModule } from './kind-registry'
import type { ViewerCtx } from '../modules/types'

const MAX_LINK_DEPTH = 5

export async function openItemById(
  id: ItemID,
  ctx: ViewerCtx,
  depth: number = 0,
): Promise<void> {
  try {
    const item = await getRpc().getItem({ id })
    await openItem(item, ctx, depth)
  } catch (err) {
    ctx.showError(err instanceof Error ? err.message : String(err))
  }
}

export async function openItem(
  item: Item,
  ctx: ViewerCtx,
  depth: number = 0,
): Promise<void> {
  if (depth > MAX_LINK_DEPTH) {
    ctx.showError('链接层数过深')
    return
  }

  if (item.role === 'itemlink') {
    if (item.target_id === null) {
      ctx.showError('链接目标不存在')
      return
    }
    await openItemById(item.target_id, ctx, depth + 1)
    return
  }

  if (item.role === 'entity') {
    if (item.kind === null || getKindModule(item.kind) === undefined) {
      ctx.showError('没有合适的打开方式')
      return
    }
    ctx.navigate(item.id)
    return
  }

  if (item.role === 'textline') {
    if (item.parent_id !== null) {
      ctx.navigate(item.parent_id)
    } else {
      ctx.navigate(item.id)
    }
    return
  }

  if (
    item.role === 'page' ||
    item.role === 'image' ||
    item.role === 'file' ||
    item.role === 'database' ||
    item.role === 'tag'
  ) {
    ctx.navigate(item.id)
    return
  }

  ctx.showError('没有合适的打开方式')
}
