# 前端文件地图

> 新增/移动 `apps/web/src` 文件时必须同步本表；没有映射说明该区域没有文档。

## 入口与全局

| 文件 | 职责 | 文档 |
|---|---|---|
| `src/main.tsx` | React mount | [app shell](../views/app-shell.md) |
| `src/App.tsx` | session/connect/route/ViewerCtx | [app shell](../views/app-shell.md) |
| `src/style.css` | 全局布局/编辑器/组件样式 | [designs](../designs.md)、[architecture](../architecture.md) |

## views

| 文件 | 职责 | 文档 |
|---|---|---|
| `views/ConnectScreen.tsx` | API 连接 | [app shell](../views/app-shell.md) |
| `views/MainLayout.tsx` | Sidebar/main/peek 壳 | [app shell](../views/app-shell.md) |
| `views/ItemView.tsx` | Item 加载、Breadcrumbs、TagBar | [item view](../views/item-view.md) |
| `views/PlazaView.tsx` | 列表筛选 | [plaza](../views/plaza.md) |
| `views/SettingsView.tsx` | sys.config 编辑 | [settings](../views/settings.md) |
| `views/Sidebar.tsx` | 树/新建/菜单 | [sidebar](../views/sidebar.md) |
| `views/SidebarItemMenu.tsx` | 节点菜单 | [sidebar](../views/sidebar.md) |
| `views/MoveToDialog.tsx` | MoveTo | [dialogs](../views/dialogs.md) |
| `views/SidePeek.tsx` | 右侧预览 | [side peek](../views/side-peek.md) |
| `views/Breadcrumbs.tsx` | 路径导航 | [breadcrumbs](../views/breadcrumbs.md) |

## modules

| 文件 | 职责 | 文档 |
|---|---|---|
| `modules/types.ts` | ViewerCtx/ItemModule | [architecture](../architecture.md) |
| `modules/registry.ts` | role/kind registry | [architecture](../architecture.md) |
| `modules/page.tsx` | PageFull、PageBlock 调度、页面交互 | [PageFull](../editor/page-full.md) |
| `modules/page-block.tsx` | block 外壳/gutter/拖拽 | [PageBlock](../editor/page-block.md) |
| `modules/text-block.tsx` | 共享文本输入 | [TextBlock](../editor/text-block.md) |
| `modules/slash-menu.tsx` | Slash UI | [SlashMenu](../editor/slash-menu.md) |
| `modules/block-menu.tsx` | block 菜单 | [dialogs](../views/dialogs.md) |
| `modules/image.tsx` | image block/full | [image](../editor/image.md) |
| `modules/image-lightbox.tsx` | 全屏图片 | [image](../editor/image.md) |
| `modules/file.tsx` | file block/full | [file](../editor/file.md) |
| `modules/itemlink.tsx` | 块级链接 | [itemlink](../editor/itemlink.md) |
| `modules/item-picker.tsx` | Item 选择器 | [dialogs](../views/dialogs.md) |
| `modules/entity.tsx` | entity 分发 | [entity/manga](../editor/entity-manga.md) |
| `modules/manga.tsx` | manga reader | [entity/manga](../editor/entity-manga.md) |
| `modules/database.tsx` | database 呈现 | [database](../editor/database.md) |
| `modules/page-card.tsx` | page card/block link | [PageFull](../editor/page-full.md) |
| `modules/page-title.tsx` | 页面标题保存 | [PageFull](../editor/page-full.md) |
| `modules/inline-text.tsx` | inline token 渲染 | [itemlink](../editor/itemlink.md) |
| `modules/item-icon.tsx` | emoji/icon | [tags/icons](../mechanisms/tags-and-icons.md) |
| `modules/tag.tsx` | tag full/card | [tags/icons](../mechanisms/tags-and-icons.md) |

## lib

| 文件 | 职责 | 文档 |
|---|---|---|
| `lib/blob.ts` | upload/media attributes | [blobs](../mechanisms/blobs-and-thumbnails.md) |
| `lib/caret-edge.ts` | 视觉行 caret 判断 | [focus/caret](../editor/focus-and-caret.md) |
| `lib/text-block-editor.ts` | slash/heading/list/split/paste helpers | [Keyboard](../editor/keyboard.md)、[SlashMenu](../editor/slash-menu.md) |
| `lib/text-list.ts` | list marker/checked helpers | [Lists/todos](../editor/lists-and-todos.md) |
| `lib/marquee.ts` | 框选矩形几何 | [Selection](../editor/selection.md) |
| `lib/order.ts` | 分数排序 | [Page state](../state/page-state.md) |
| `lib/page-blocks.ts` | block duplicate/delete policy | [PageBlock](../editor/page-block.md) |
| `lib/sidebar-tree.ts` | tree 规则 | [Sidebar](../views/sidebar.md) |
| `lib/open-item.ts` | open resolver | [ItemView](../views/item-view.md) |
| `lib/item-url.ts` | item URL | [Breadcrumbs](../views/breadcrumbs.md) |
| `lib/image-thumb.ts` | thumb 选择/宽度 | [Image](../editor/image.md) |
| `lib/hash-router.ts` | routes | [Architecture](../architecture.md) |
| `lib/settings.ts` | base URL/localStorage | [Session](../state/session-and-rpc.md) |
| `lib/tags.ts` | TagStore | [Tags/icons](../mechanisms/tags-and-icons.md) |
| `lib/date-format.ts` | 日期展示 | [Sidebar](../views/sidebar.md) |

## tests

`apps/web/test/*.test.ts` 覆盖纯函数与 registry；交互测试见 [testing](../mechanisms/testing.md)。浏览器验证不进入仓库自动化，但每次 UI 改动必须执行。
