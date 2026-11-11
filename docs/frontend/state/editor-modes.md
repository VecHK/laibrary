# 编辑器模式

## 三种模式

```text
编辑态：active_block_id + textarea caret
Block 选中：selected_ids，一个或多个 block 高亮
文本选择：window.getSelection()，浏览器原生
```

三者不能同时生效：

- `focusBlock` 清空 selected_ids；
- `selectOne`/范围选择清空 active_block_id 与 focus_request；
- 内容区文本拖选不启动 marquee，也不创建 block selection。

## 编辑态

- 只有一个 active block；
- TextBlock 渲染 textarea；
- `focus_request` 决定 focus 和 caret；
- Escape 将当前 block 转为选中模式；
- Enter/Backspace 可能引发结构变更。

## Block 选中

- 选中集合由 `selected_ids` 持有；
- 普通 Arrow 移动；Shift+Arrow 扩展；
- Delete/Backspace 批量删除；
- Cmd/Ctrl+Z 撤销最近一次结构删除；
- 点击空白区块/第二次 Escape 清除。

## 文本选择

- 只在 `.page-full` 内部起手；
- 不在 `.page-full` 内启动 marquee；
- 不进入 block selection；
- inactive TextBlock 的 click 先检查 `window.getSelection()`，有文本选区则不激活。

## Marquee

- 起点必须在 `.item-content` 内、`.page-full` 外；
- 框选以页面坐标与 block rect 相交；
- 结束写入 selected_ids；
- 与文字选择互斥。

## Focus 状态转换

| 从 | 操作 | 到 |
|---|---|---|
| 编辑 | Esc | 当前 block 选中 |
| 编辑 | 点击另一个文本 block | 新 block 编辑 |
| 选中 | Arrow | 移动选中 |
| 选中 | Enter/handle? | 仍由各操作决定 |
| 文本选择 | 点击 TextBlock | 若 selection 为空则编辑 |
| marquee | pointerup | 选中集合 |

## 相关

- [Focus/caret](../editor/focus-and-caret.md)
- [Selection](../editor/selection.md)
- [Keyboard](../reference/keyboard-map.md)
