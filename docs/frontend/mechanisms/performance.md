# 性能

## 原则

- 输入不触发整页刷新；
- 本地 optimistic + 后台持久化；
- 树/列表分页；
- 图片 lazy/thumbnail；
- 避免无界查询。

## 编辑器

- PageFull 本地 children；
- TextBlock 400ms debounce + write chain；
- 排序只更新被移动 Item；
- 大页面当前仍一次 `listing(limit:0)`；未来需要分页/虚拟化。

## 图片

- 4 档缩略图；
- 只放大请求更高档；
- 删除旧图前先预加载新图；
- 不把原图用于列表。

## 侧边栏

- 每层 200；
- 展开 lazy load；
- 无全表根扫描（server 排除 sys）。

## 风险

- 无虚拟列表；极大页面/树可能卡顿。
- Breadcrumbs 逐级 getItem 是 N+1，深度通常很小。
- 图片大规模列表未做 windowing。

## 相关

- [Blobs/thumbnails](blobs-and-thumbnails.md)
- [Page state](../state/page-state.md)
