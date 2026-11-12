# Sidebar

[Sidebar.tsx](../../../packages/web/src/views/Sidebar.tsx)、[SidebarItemMenu.tsx](../../../packages/web/src/views/SidebarItemMenu.tsx)

## 内容

- 品牌 Laibrary；
- 广场入口；
- page/database/itemlink 树；
- 底部新建页面/数据库；
- trash/settings 入口（当前范围）。

## 树

- roots + children cache；
- 只有 page 可展开；
- 每层最多 200；
- lazy load children；
- itemlink 只在 target 是 page 时可添加子页。

## 节点动作

- `+`：页面/数据库/目标为 page 的 itemlink；
- `···`：Copy link、Rename、Move to、Remove、Open in new tab、Open in side peek；
- 菜单显示 Last edited / Created Date；
- 删除当前仍是永久删除 + 空容器限制（Trash TODO）。

## 状态

Sidebar 本地持有 roots/children/expanded/menu/rename/move/peek；通过 `refreshSidebar` 重新拉取。

## 相关

- [Breadcrumbs](breadcrumbs.md)
- [Move picker](dialogs.md)
- [Page state](../state/page-state.md)
