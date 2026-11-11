# Settings

[SettingsView.tsx](../../../apps/web/src/views/SettingsView.tsx)

## 内容

- 读取 `sys.config` snapshot；
- 按 type 渲染 string/number/boolean/json 输入；
- 修改调用 `updateConfig`；
- 显示配置版本、API base URL；
- 允许清除 base URL 重新连接。

## 边界

- runtime 配置在 Item，不在 env；
- 设置变更热生效（读取方自行使用）；
- 无鉴权。

## 相关

- [Config](../mechanisms/config.md)
- [Session](../state/session-and-rpc.md)
