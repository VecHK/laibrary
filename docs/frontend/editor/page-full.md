# PageFull

[page.tsx](../../../apps/web/src/modules/page.tsx)

## 职责

PageFull 是页面编辑器容器：

- 加载 page 的直接 children；
- 渲染标题、TextBlock、各模块 Block、PageBlock 外壳；
- 持有 children、编辑态、block 选中、focus request、undo、marquee；
- 处理文件/文本 drop、block 排序、slash 创建、页面级键盘。

## 结构

```text
.page-full
  .page-header（icon + title input）
  children-list
    PageBlock
      TextBlock / module.Block
  hidden image/file inputs
  ItemPicker / SlashMenu / marquee overlay
```

Page 标题不是 block：不参与 PageBlock 包装、block selection、marquee 选中。

## 加载

- item.id 变化时重置 active/selection/history，调用 `loadChildren(true, true)`。
- `auto_focus_first` 只对单个空 text role 生效。
- 加载失败 toast；children 保持旧值或 loading 状态。

## 写路径

- 文本 title 由 TextBlock 自己保存；
- 结构调整由 PageFull 调 `addItem/updateItem/deleteItems`；
- 删除后刷新 sidebar（页面树可能变化）；
- 失败时 reload children，避免本地/服务端分叉。

## 选中与删除

- 选中态通过 `selected_ids`；
- 批量删除调用 `deleteItems`，push undo；
- 删除后清空选择、刷新 sidebar。

## 为什么

PageFull 是页面级状态的单一所有者；如果每个 block 各自持有整页状态，拖拽排序、undo、focus 和批量删除会互相竞争。

## 相关

- [Page state](../state/page-state.md)
- [PageBlock](page-block.md)
- [TextBlock](text-block.md)
- [Selection](selection.md)
