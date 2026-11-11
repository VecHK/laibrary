# App Shell

[App.tsx](../../../apps/web/src/App.tsx)、[MainLayout.tsx](../../../apps/web/src/views/MainLayout.tsx)、[ConnectScreen.tsx](../../../apps/web/src/views/ConnectScreen.tsx)

## App

- 读 localStorage base URL；
- 建立 RPC + TagStore；
- 维持 session；
- 构造 `ViewerCtx`；
- hash 路由分支。

## ConnectScreen

- 输入/校验 API URL；
- 测试 listing；
- 预加载 tags；
- 成功后进入 MainLayout。

## MainLayout

```text
.layout
  Sidebar
  main
    loading / Settings / Plaza / ItemView
  SidePeek (optional)
```

- tags 未加载时显示 loading；
- `sidebar_key` 只驱动 Sidebar 刷新；
- `refresh_key` 驱动 ItemView 重载；
- side peek 是覆盖面板，不改变主路由。

## 相关

- [Session/RPC](../state/session-and-rpc.md)
- [Sidebar](sidebar.md)
- [ItemView](item-view.md)
