import type { Item, ItemID } from '@laibrary/types'
import type { ViewerCtx } from '../modules/types'
import { ItemPicker } from '../modules/item-picker'

export function MoveToDialog({
  item,
  ctx,
  on_close,
}: {
  item: Item
  ctx: ViewerCtx
  on_close: () => void
}) {
  const nextOrderFor = async (parent_id: ItemID | null): Promise<number> => {
    const last = await ctx.api.rpc.listing({
      limit: 1,
      sort_by: 'order_index',
      desc: true,
      filter_rules: [{ name: 'parent', input: parent_id, logic: 'and' }],
    })
    return (last[0]?.order_index ?? 0) + 1
  }

  const moveTo = (parent_id: ItemID | null) => {
    void (async () => {
      try {
        const order_index = await nextOrderFor(parent_id)
        await ctx.api.rpc.updateItem({
          id: item.id,
          data: { parent_id, order_index },
        })
        ctx.refresh()
        on_close()
      } catch (error) {
        ctx.showError(error instanceof Error ? error.message : String(error))
      }
    })()
  }

  return (
    <ItemPicker
      ctx={ctx}
      title={item.role === 'database' ? '移动数据库到…' : '移动页面到…'}
      roles={['page']}
      exclude_ids={[item.id]}
      allow_root
      onSelect={target => moveTo(target.id)}
      onSelectRoot={() => moveTo(null)}
      onClose={on_close}
    />
  )
}
