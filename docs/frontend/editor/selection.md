# 选择

## 三种选择

1. 编辑态：textarea caret；
2. Block Selection：`selected_ids`；
3. Text Selection：浏览器原生。

必须互斥，不能用一个“selected”概念混淆。

## 进入 Block Selection

- 编辑态 Esc；
- 点击 block handle（同时打开菜单）；
- 内容区外 marquee。

## Marquee

- 起点在 `.item-content` 内、`.page-full` 外；
- 页面 fixed overlay；
- 与 `.children-list .page-block` rect 相交即选中；
- 拖动 <4px 视为点击空白并清除；
- 框选期间临时 `user-select:none`；
- 框选结束清 overlay。

## 内容区文本选择

- 起点在 `.page-full` 内不启动 marquee；
- inactive TextBlock 拖选后 click 检查 selection，非空则不激活；
- 背景选中的 block 仍显示原生 selection。

## 键盘

- Arrow 移动单选；
- Shift+Arrow 扩展；
- Esc 清除；
- Delete/Backspace 批量删除；
- Cmd/Ctrl+Z 结构 undo。

## 为什么不使用 Shift+Click/Cmd+Click

点击修饰键会抢占浏览器的文本选择；block 选择由 Esc、handle、marquee 和 Shift+Arrow 完成。

## 相关

- [Editor modes](../state/editor-modes.md)
- [Keyboard map](../reference/keyboard-map.md)
- [PageFull](page-full.md)
