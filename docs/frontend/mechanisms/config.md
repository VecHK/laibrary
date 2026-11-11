# 配置

## 读取

`ctx.api.rpc.getConfig()` 返回 `ConfigSnapshot`：

- version；
- entries: key/title/type/value。

SettingsView 按 type 渲染控件。

## 写入

`updateConfig({ key, value })`：

- server ConfigStore 校验 key 前缀和值类型；
- 更新 sys.config 行；
- 缓存失效。

## 两层配置

- Bootstrap：`.env`/env，连接/端口/路径；
- Runtime：`sys.config` Item，热更新；
- runtime 不接受 env 覆盖。

## 前端

- `sys.config.ui_page_size` 控制 Plaza page size；
- `sys.config.manga_default_direction` 控制 manga；
- 其他配置由服务端读取。

## 相关

- [Settings](../views/settings.md)
- [Runtime spec](../../item/06-runtime.md)
