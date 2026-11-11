# Block 拖拽排序

[page-block.tsx](../../../apps/web/src/modules/page-block.tsx)、[page.tsx](../../../apps/web/src/modules/page.tsx)

## 拖拽源

- image：整块 `draggable`；
- 其他 block：只从 `block-drag-handle` 拖；
- `dataTransfer` 写 `text/laibrary-block` = item id；
- 从 textarea/button/resizer 起手不开始拖拽。

## 插入线

- PageBlock 的 `dragover` 根据鼠标相对 block 中线决定 before/after；
- PageFull 保存 `drop_indicator`；
- 只显示 2px 插入线，不做整页覆盖提示。

## drop 处理

`handleDrop(dragged_id, target_id, position)`：

1. 从 children 移除 source；
2. 在 target 前后计算 insert index；
3. 取相邻 order_index 的中点；
4. 本地 splice + 更新 order；
5. 只更新被移动 Item 的 `order_index`。

失败 reload children。

## 外部文件

Files 不进内部拖拽逻辑；PageFull 上传图片/文件并按目标位置插入。外部文本同理，交给 PageFull 分块。

## 相关

- [PageBlock](page-block.md)
- [Paste/drop](paste-and-drop.md)
- [PageFull](page-full.md)
