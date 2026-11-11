# Accessibility

## 键盘

- 所有核心编辑操作可用键盘完成；
- Slash 支持 ↑↓/Enter/Tab/Esc；
- Block 选中支持方向键、Shift+Arrow、Delete；
- focus/caret 不因保存/刷新丢失。

## 语义

- Breadcrumbs 使用 `<nav aria-label="Breadcrumb">` 和 `aria-current="page"`；
- checkbox 有 `aria-label`；
- 图标按钮提供 title/aria-label；
- Slash menu 使用 listbox/option/aria-selected。

## hover 控件

- 核心编辑不依赖 hover；
- hover 只揭示辅助菜单/resize；触屏用 `@media (hover:none)` 提高可见性。

## 焦点

- 不能把焦点留在已删除 DOM；
- 结构操作后显式 focus；
- dropdown/portal 不抢 textarea 焦点（onMouseDown preventDefault）。

## 现状限制

- 没有完整屏幕阅读器测试；
- 图片 caption/菜单等还需持续补 aria；
- 颜色对比未系统审计。

## 相关

- [Designs](../designs.md)
- [Keyboard map](../reference/keyboard-map.md)
