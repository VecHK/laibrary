# Undo / Redo

## 当前实现

页面内存级、结构删除优先。

```ts
type PageHistoryEntry = {
  ids: readonly ItemID[]
  items: readonly Item[]
}
```

- 批量 Delete：`deleteItems(ids)` 返回快照，push undo。
- 空 text-block/heading Backspace：删除当前，`deleteItems([id])` 快照，push undo；焦点去前一个 text block 末尾。
- Undo：`restoreItems(entry.items)` → 同 ID 插回 → push redo。
- Redo：同 ID 再 `deleteItems`。
- 不恢复 thumbnails；图片缩略图按懒生成。

## Native Text Undo

- TextBlock 的 textarea 默认使用浏览器原生 undo；
- PageFull 只在 block 选中模式拦截 Cmd/Ctrl+Z；
- 不能在普通编辑中无条件抢 Cmd/Ctrl+Z，否则会破坏文字输入历史。

## Structural Undo 交接

空 block Backspace 删除后，焦点会进入前一个 textarea；此时按键目标是 textarea：

1. 删除成功设置 `structural_undo_ref = true`；
2. PageFull `onKeyDownCapture` 检测 textarea + Cmd/Ctrl+Z + flag；
3. 阻止原生 undo，调用 `undoDelete()`；
4. flag 被清空；
5. 用户继续输入/切换 block/切页后，textarea 恢复原生 undo。

这是“结构删除后立刻撤销”的专用交接，不是通用 command history。

## 当前限制

- 结构历史只在当前 PageFull 内存；刷新/切页丢失；
- 列表/勾选空 Backspace 转 text-block 不删除，因此不进 delete 历史；
- 文本、移动、resize、caption 的 undo 未统一；
- 完整方案见根 `TODOS.md` 的 Undo/Redo。

## 为什么

结构删除失去原 Item；必须用快照恢复同一 ID，不能用 `addItem` 重建新 ID。文字编辑仍交给原生 textarea，避免两套历史互相冲突。

## 相关

- [Page state](page-state.md)
- [Keyboard](../reference/keyboard-map.md)
- [Backspace rule](../editor/keyboard.md)
