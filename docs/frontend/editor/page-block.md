# PageBlock

[page-block.tsx](../../../apps/web/src/modules/page-block.tsx)

## 职责

PageBlock 是编辑器 block 的外壳，不拥有 Item 内容：

- `data-block-id`；
- block gutter：`＋`、drag handle；
- hover 显隐；
- selected / drop-before / drop-after class；
- BlockMenu；
- 拖拽源和 drop target；
- 文件 drop 与内部 block drop 的路由。

## 子内容

`content` 来自：

- text role → PageFull 内共享 TextBlock；
- 其他 role → `module.Block(item, ctx)`；
- 无 Block → Presenter.card。

PageBlock 不重复输入逻辑。

## 拖拽

- `drag_anywhere`（image）时整块可拖；
- text block 只从 handle 拖；
- `dataTransfer` 使用 `text/laibrary-block`；
- 外部文本用 `text/plain`，PageBlock 不拦截，交给 PageFull；
- Files 也交给 PageFull。

## BlockMenu

菜单动作：

- Duplicate
- Move up/down
- Delete

容器（page/database）的菜单删除仍受 `blockCanDelete` 限制；批量 block 删除是另一条路径。

## 相关

- [Drag/reorder](drag-reorder.md)
- [Paste/drop](paste-and-drop.md)
- [PageFull](page-full.md)
