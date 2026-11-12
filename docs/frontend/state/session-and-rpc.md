# Session 与 RPC

## 连接

[ConnectScreen](../../../packages/web/src/views/ConnectScreen.tsx) 接收 API base URL：

1. `settingsParseBaseUrl` 只允许 http/https；
2. `CreateRpcClient({ base_url })`；
3. `rpc.listing({ limit: 1 })` 做连通性检查；
4. `CreateTagStore({ rpc })` 并 `load()`；
5. `settingsSetBaseUrl` 写入 localStorage；
6. App 设置 session，进入 MainLayout。

连接失败不会留下半初始化 session。

## ViewerCtx

```ts
type ViewerCtx = {
  api: { base_url, rpc }
  tags: TagStore
  modules: ItemModuleRegistry
  navigate
  refresh
  refreshSidebar
  showError
  showNotice
}
```

- `api` 在 App 每次 render 重新构造，但 `rpc`/`tags` 来自稳定 session；依赖 effect 使用 `ctx.api.rpc` 而不是 `ctx.api`。
- `navigate` 走 hash router。
- `refresh` 重载当前路由/ItemView；`refreshSidebar` 只重载树。
- 文本保存不调用 `ctx.refresh()`。

## RPC 约定

- Action payload 由 `@laibrary/types` 的 zod schema 在 API 边界校验。
- RPC client 对响应再次 parse，未知/坏结构直接报错。
- 错误对象包含 status/code/message；UI 只显示 message，不把服务端堆栈展示给用户。
- 所有 action 名称集中在 `__RPC_ACTION_NAMES__`。

## Base URL

- localStorage 是唯一持久化位置。
- 设置页允许清空并重新连接。
- API 地址不写进 Item/attributes。
- 当前无鉴权；只能用于可信局域网。

## 失败与重试

- 连接失败：留在 ConnectScreen 显示错误。
- 读取失败：当前视图显示错误/not found；PageFull 可 reload children。
- 写入失败：toast，并在结构操作时 `loadChildren()` 校正。
- 不允许 catch 后假装成功。

## 相关

- [architecture](../architecture.md)
- [errors/loading](../mechanisms/errors-and-loading.md)
