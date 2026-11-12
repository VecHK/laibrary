# 前端架构

## 组合根

`App.tsx` 是唯一组合根：

1. 读取 localStorage 中的 API base URL；
2. `ConnectScreen` 建立 `RpcClient` 与 `TagStore`；
3. session 保存在 App state；
4. 用显式 `ViewerCtx` 向下传递 `api`、`tags`、`modules`、`navigate`、`refresh`、`refreshSidebar`、`showError`、`showNotice`；
5. hash route 决定渲染 `PlazaView`、`ItemView`、`SettingsView`。

没有模块级 RPC client，没有 tag singleton，没有隐式全局 store。

```text
App
 ├─ ConnectScreen（无 session）
 └─ MainLayout（有 session）
     ├─ Sidebar
     ├─ main
     │   ├─ PlazaView
     │   ├─ ItemView → ItemContent → module.Presenter.full → PageFull
     │   └─ SettingsView
     └─ SidePeek → ItemView
```

## 路由器

[hash-router.ts](../../packages/web/src/lib/hash-router.ts) 解析：

- `#/plaza`
- `#/item/:id`
- `#/settings`

`ViewerCtx.navigate` 支持 ItemID 或 HashRoute。Breadcrumbs、Sidebar、itemlink、page block 都走这一入口；不直接修改 history。

## 模块系统

[registry.ts](../../packages/web/src/modules/registry.ts) 持有：

- `role_modules: Record<Role, ItemModule>`
- `kind_modules: ItemModule[]`

`ItemModule` 提供：

- `Presenter.card/full`
- 可选 `Block`
- 可选 `inlineIcon/inlineMeta`

PageFull 对 text role 直接使用共享 TextBlock；image/file 等使用模块 `Block`；未知 kind 由 entity 模块报“没有合适的打开方式”。

## 状态所有权

| 状态 | 所有者 | 说明 |
|---|---|---|
| session/base URL/rpc/tags | App | 重新连接时整体替换 |
| route | `useHashRoute` | hash 是导航事实源 |
| sidebar tree/expanded menu | Sidebar | 页面本地 |
| Item item/not_found | ItemView | 切换 item 时重载 |
| page children/title | PageFull | 编辑器本地持有 |
| active block/selection | PageFull | 编辑和 block 选中互斥 |
| textarea value/save queue | TextBlock | 文本输入局部状态 |
| tags | TagStore | 显式注入，不全局单例 |
| settings snapshot | SettingsView | 打开时加载 |

## 数据路径

读取：

```text
View / PageFull
  → ViewerCtx.api.rpc
  → POST /action
  → @laibrary/types zod
  → Item/Action result
```

写入：

- 文本输入：TextBlock 本地更新 → 400ms debounce → `updateItem`
- Page 结构：PageFull 本地 children → `addItem/updateItem/deleteItems`
- 文件/图片：`POST /blob` → `addItem` with blob_id
- 排序：本地 order_index → `updateItem`
- Undo：`deleteItems` 快照 → `restoreItems` 原 ID

## 样式边界

`style.css` 分为：

1. 基础 reset/layout；
2. 通用 card/panel/button；
3. Page/PageBlock/TextBlock 编辑器；
4. Image/File/Itemlink/Database/Entity/Manga；
5. Sidebar/Breadcrumbs/Picker/Dialog；
6. side peek 与响应式。

新增组件应优先复用现有 CSS 变量/层级，不把模块特例堆到全局 reset。

## 错误边界

- RPC 错误在视图内 `showError`；需要时 reload 当前 children。
- 顶层没有 React ErrorBoundary；未捕获渲染异常由浏览器暴露，不能伪装成功。
- 失败保存不把 UI 标成成功；上传/转换失败保留重试路径。

## 相关

- [session/rpc](state/session-and-rpc.md)
- [PageFull 状态](state/page-state.md)
- [编辑器模式](state/editor-modes.md)
- [file map](reference/file-map.md)
