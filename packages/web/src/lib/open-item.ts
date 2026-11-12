import type { Item, ItemID } from '@laibrary/types'
import { isTextBlockRole } from '@laibrary/types'
import type { ViewerCtx } from '../modules/types'

const MAX_LINK_DEPTH = 5

export async function openItemById(
  id: ItemID,
  ctx: ViewerCtx,
): Promise<void> {
  await openItemByIdDepth(id, ctx, 0)
}

async function openItemByIdDepth(
  id: ItemID,
  ctx: ViewerCtx,
  depth: number,
): Promise<void> {
  try {
    const item = await ctx.api.rpc.getItem({ id })
    await openItemDepth(item, ctx, depth)
  } catch (err) {
    ctx.showError(err instanceof Error ? err.message : String(err))
  }
}

export async function openItem(item: Item, ctx: ViewerCtx): Promise<void> {
  await openItemDepth(item, ctx, 0)
}

async function openItemDepth(
  item: Item,
  ctx: ViewerCtx,
  depth: number,
): Promise<void> {
  if (depth > MAX_LINK_DEPTH) {
    ctx.showError('链接层数过深')
  } else if (item.role === 'itemlink') {
    if (item.target_id === null) {
      ctx.showError('链接目标不存在')
    } else {
      await openItemByIdDepth(item.target_id, ctx, depth + 1)
    }
  } else if (item.role === 'entity') {
    if (item.kind === null || ctx.modules.getKind(item.kind) === undefined) {
      ctx.showError('没有合适的打开方式')
    } else {
      ctx.navigate(item.id)
    }
  } else if (isTextBlockRole(item.role)) {
    if (item.parent_id !== null) {
      ctx.navigate(item.parent_id)
    } else {
      ctx.navigate(item.id)
    }
  } else {
    ctx.navigate(item.id)
  }
}
