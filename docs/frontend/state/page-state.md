# PageFull 状态

## 所有者

`PageFull` 拥有当前 page 的 children 与页面级交互状态。

关键 state/ref：

- `children` / `children_ref`：排序后的直接子 Item；
- `active_block_id`：编辑态；
- `selected_ids` / `selection_anchor_id`：block 选中；
- `focus_request`：要求 TextBlock 聚焦/caret；
- `drop_indicator`：block 拖拽插入线；
- `undo_stack` / `redo_stack`：结构删除历史；
- `marquee`：内容区外框选矩形；
- `structural_undo_ref`：删除后一次性 Cmd/Ctrl+Z 交接。

## children 原语

```ts
syncChildren(next)
patchChild(id, patch)
insertChild(child)
removeChild(id)
```

- `syncChildren` 排序并同步 ref + state；
- `patchChild` 只改本地；
- 新增/删除/排序后立即更新本地，再异步 RPC；
- `removeChild` 同时清掉 active block。

## 读取

```ts
rpc.listing({
  limit: 0,
  sort_by: 'order_index',
  filter_rules: [{ name: 'parent', input: item.id, logic: 'and' }],
})
```

`limit: 0` 当前表示不限（仍受服务端上限）。加载失败保留当前页面，toast。

## 写入

- 文本：TextBlock 自己的 debounce/write queue，不经过 PageFull 每次输入。
- 结构新增：`addItem` → insertChild。
- 排序：本地交换 order_index → 两个 `updateItem`。
- 删除：`deleteItems` 快照 → removeChild；同时写 undo 栈。
- 从占位符插入：创建新 Item 后删除 placeholder，再补 text-block。
- 上传：blob upload 后创建 image/file Item；失败停止后续并 reload。

## 为什么本地持有

页面编辑器需要连续输入、拖拽和焦点保持。每次输入触发全局刷新会导致：

- textarea 重挂载、caret 丢失；
- 页面滚动跳变；
- 保存队列竞争。

见 [designs](../designs.md) 的原则和 [TextBlock](../editor/text-block.md)。

## 排序模型

`order_index` 是分数索引：

- 相邻 block 之间取中点；
- 末尾 `max + 1`；
- 拖拽只更新被移动 Item 的 order；
- 同 order 用 id 做稳定 tie-break。

## Undo 边界

`PageHistoryEntry` 当前只记录结构删除快照：

```ts
{ ids: ItemID[], items: Item[] }
```

- 批量 Delete/Backspace 删除写入；
- undo 使用 `restoreItems`，ID 不变；
- 文本输入继续用 textarea 原生 undo；
- 列表/勾选的 Backspace 转换不删除 Item，当前不写结构历史。

## 相关

- [Undo](../state/undo-redo.md)
- [PageFull](../editor/page-full.md)
- [Block selection](../editor/selection.md)
