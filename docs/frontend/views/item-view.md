# ItemView / ItemContent

[ItemView.tsx](../../../apps/web/src/views/ItemView.tsx)

## 加载

- 按 item_id + refresh_key 请求 `getItem`；
- 切换 item 时清空旧 item；
- not found 显示错误 panel；
- 失败 toast。

## 渲染

```text
.item-view
  Breadcrumbs
  .item-content
    module.Presenter.full(item, ctx)
  TagBar
```

- Breadcrumbs 在正文顶部；
- 无自定义返回按钮；
- TagBar 拥有标签输入/删除，调用 updateItem；
- module full 可能是 PageFull、ImageFull、Manga 等。

## 内容区域

`.item-content` 是 main 内的内容边界；PageFull 的 marquee 起点必须在其内、page-full 外。

## 相关

- [Breadcrumbs](breadcrumbs.md)
- [PageFull](../editor/page-full.md)
- [Tags/icons](../mechanisms/tags-and-icons.md)
