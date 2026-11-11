# 错误与加载

## 原则

- 失败必须可见；不能 catch 后返回空数组假装成功。
- 局部错误优先局部处理，不整页 loading。
- 结构操作失败要 reload children，避免本地/服务端分叉。

## 显示

- `ctx.showError(message)` → toast。
- `ctx.showNotice(message)` → 非错误提示。
- ItemView not found → panel。
- PageFull children loading → `加载中…`。
- 连接失败 → ConnectScreen 错误。

## 写入失败

- TextBlock：showError，保留本地文本；write queue 继续。
- 结构新增/删除/排序：showError + `loadChildren()`。
- 上传：停止本批后续文件，保留已成功 block，reload。
- Breadcrumb ancestor 失败：保留已有 path，不阻塞正文。

## 重试

- 重新打开 Item / 切换路由会重新加载；
- refresh/refreshSidebar 分开，避免不必要重载；
- 当前没有自动 retry/backoff。

## 相关

- [Session/RPC](../state/session-and-rpc.md)
- [Page state](../state/page-state.md)
