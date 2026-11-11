# TODOS

## Trash（回收站）

当前 `deleteItem` 是永久删除，页面/数据库容器没有级联删除；侧边栏的 Remove 在本轮只允许删除没有实质内容的页面（仅有空 text-block）或空 database。

后续实现方向：

- 数据模型：给 `items` 增加 `deleted_at`（timestamptz, nullable），或建立独立 trash 表；优先软删除列，保持单表事实源。
- 查询：公共 listing、getItem、getItems、getItemByUnityName、侧边栏树默认排除 `deleted_at IS NOT NULL` 的 Item。
- 写入：把侧边栏的 Remove 改为 `Move to Trash`，不再直接物理删除。
- 恢复：Trash 页面按删除时间列出，可恢复；恢复时如果 parent 已被删除，恢复到根目录或提示用户选择新 parent。
- 永久删除：独立 purge 操作，带二次确认；page/database 的 children 需要递归处理或逐项确认。
- 清理：永久删除 Item 后再触发 blob/thumbnail GC；确认 GC 不会误删仍被恢复中 Item 引用的 blob。
- 权限：当前无鉴权；未来多用户时，Trash 恢复/清空需要按用户隔离。
- UI：侧边栏/搜索/数据库行都要一致地隐藏或标记已删除 Item；没有“查看回收站”入口时不能悄悄隐藏。

本轮不实现，只在代码中保留 Remove 的边界提示。尤其不要直接把富文本/复杂 Item 塞进 Trash，需要先定义快照边界。

## Open in new window

`Open in new window` 需要真正的桌面窗口能力，Web 无法可靠实现。

未来 Electron：

- 使用 `BrowserWindow` 打开同一个 hash 路由 `#/item/:id`；
- 复用和服务端一致的 item URL 生成逻辑；
- 处理多窗口下的刷新、主题、连接 session 和关闭确认；
- 不把 Electron 依赖提前引入 Web 包。

## 其他

- 页面/数据库容器删除的级联策略，与 Trash 一起设计。
- 侧边栏树的分页/加载更多（当前每层最多 200 条）。

## Undo / Redo

当前只实现页面内存级、批量 block 删除的 undo/redo：

- `deleteItems` 返回完整子树快照；
- `restoreItems` 用原 Item ID 插回；
- 历史只存在当前 PageFull 内存，刷新/切页丢失；
- 文本编辑继续使用浏览器原生 undo。

未来完整方案：

- 统一 command journal，覆盖文本、移动、resize、align、caption、上传等操作；
- 历史持久化/跨刷新恢复；
- 与 Trash/永久删除、权限和多用户协作一起设计；
- 富文本 Item 的 undo 不能只依赖粗粒度 Item 快照。

- 嵌套列表、列表缩进/多级列表尚未实现。
