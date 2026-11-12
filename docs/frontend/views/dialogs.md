# 对话框与浮层

## BlockMenu

[block-menu.tsx](../../../packages/web/src/modules/block-menu.tsx)：Duplicate、Move、Delete；容器删除受 `blockCanDelete`。

## ItemPicker

[item-picker.tsx](../../../packages/web/src/modules/item-picker.tsx)：搜索 Item、角色过滤、选择目标；供 itemlink/MoveTo 使用。

## MoveToDialog

[MoveToDialog.tsx](../../../packages/web/src/views/MoveToDialog.tsx)：移动 Item 到 page/database；排除自身/非法目标。

## SlashMenu

[slash-menu.tsx](../../../packages/web/src/modules/slash-menu.tsx)：分组、搜索、键盘选择、插入命令。

## Lightbox

[image-lightbox.tsx](../../../packages/web/src/modules/image-lightbox.tsx)：portal 全屏、原图、关闭/Esc/缩放平移。

## 相关

- [SlashMenu](../editor/slash-menu.md)
- [Image](../editor/image.md)
