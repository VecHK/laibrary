# Tags 与 Icons

## TagStore

- App 组合根创建并预加载；
- `ctx.tags.titleOf(id)` 给 UI 提供标题；
- `newTag/getTagByTitle` 在 ItemView 添加标签时使用；
- 标签变更通过 `updateItem({ tags })`。

## TagBar

- 显示当前标签 chip；
- 输入回车/失焦添加；
- ✕ 删除；
- 失败 toast；
- 刷新 tags store。

## Icons

- Page/database/itemlink 的 emoji 存 `attributes.icon`；
- `ItemIcon` 统一渲染；
- 没有 icon 时回退 role 图标；
- `ItemIconButton` 在页面头选择 emoji。

## 相关

- [ItemView](../views/item-view.md)
- [PageFull](../editor/page-full.md)
