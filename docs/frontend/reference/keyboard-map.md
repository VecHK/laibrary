# 键盘映射

## 编辑态（textarea）

| 键 | 行为 |
|---|---|
| Enter | 光标拆分；text-block → text-block；heading → text-block；list → 同 kind；todo → 未勾选；新项 caret 0 |
| Shift+Enter | 块内换行 |
| ArrowUp | caret 在首视觉行 → 前一个 text block/选中非文本；否则原生 |
| ArrowDown | caret 在末视觉行 → 后一个；否则原生 |
| Backspace（caret 0） | 空 text-block/heading：删除当前并 focus 前一个末尾；空 list/todo：转 text-block；非空：合并/删除；无前一个文本目标：no-op |
| Escape | 退出编辑，进入 block 选中 |
| Cmd/Ctrl+Z | 结构删除后一次性 undo；其他情况原生 textarea undo |
| Slash | 行首 `/` 打开菜单 |
| `# ` / `## ` / `### ` | 空 text-block → heading |
| `- ` / `1. ` / `a. ` | 空 text-block → list |
| `[] ` / `【】 ` | 空 text-block → todo |

## Slash 菜单

| 键 | 行为 |
|---|---|
| ArrowDown/Up | 按显示顺序循环 |
| Enter/Tab | 执行当前命令 |
| Esc | 关闭菜单，不改文本 |

## Block 选中模式

| 键 | 行为 |
|---|---|
| ArrowUp/Down | 移动单选 |
| Shift+Arrow | 扩展 selection |
| Escape | 清除选择 |
| Delete/Backspace | 批量删除选中（进入结构 undo） |
| Cmd/Ctrl+Z | 撤销最近结构删除 |
| Shift+Cmd/Ctrl+Z | 重做 |

## Marquee

| 操作 | 行为 |
|---|---|
| 从 `.page-full` 外拖拽 | 创建矩形框选 |
| 从 `.page-full` 内拖拽 | 浏览器文本选择 |
| <4px | 清除选择 |
| Esc | 清除 |

## 页面标题

- Enter blur；
- 输入 debounce 保存；
- 不参与 block 选择。

## 相关

- [Editor modes](../state/editor-modes.md)
- [Keyboard feature doc](../editor/keyboard.md)
