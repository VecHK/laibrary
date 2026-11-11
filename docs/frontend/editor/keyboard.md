# 键盘与 Backspace

## 编辑态

| 按键 | 行为 |
|---|---|
| Enter | 当前光标拆分；list/todo 新项同类型；heading 新项 text-block；新项 caret 0 |
| Shift+Enter | 块内软换行 |
| Backspace（caret 0） | 见下节 |
| ArrowUp/Down | 首/末视觉行跨 block；否则原生 caret |
| Escape | 退出编辑，进入 block 选中 |
| Cmd/Ctrl+Z | 结构删除交接或 textarea 原生 undo |
| Delete | 只在 block 选中模式批量删除 |

## 空 Block Backspace 规则

当前编辑态且 `value.length === 0`：

### text-block / heading

- 前一个兄弟是 text role：删除当前，focus 前一个末尾；
- 没有前一个，或前一个不是 text role：no-op；
- 删除使用 `deleteItems` 快照并写入 undo。

### text-list / text-todo

- 不删除；
- 同 ID 转 `text-block`，title `''`，清空 list/checked attributes；
- 保持 focus/caret。

### 举例

```text
text-list
text-list
text-list
text-block <- empty, editing
```

Backspace → 删除最后一个 text-block，caret 进入第三个 text-list 末尾。

## 删除后立即 Undo

- 删除成功置 `structural_undo_ref`；
- PageFull capture 拦截 textarea 的 Cmd/Ctrl+Z；
- `undoDelete` 用 `restoreItems` 恢复同一 ID；
- 用户继续输入/切换后恢复原生 undo。

## 选中态

见 [keyboard-map](../reference/keyboard-map.md)。

## 相关

- [Undo](../state/undo-redo.md)
- [Focus](focus-and-caret.md)
- [Lists/todos](lists-and-todos.md)
