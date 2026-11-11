# Breadcrumbs

[Breadcrumbs.tsx](../../../apps/web/src/views/Breadcrumbs.tsx)

## 显示

```text
🏠 Home Page / root ancestor / ... / current Item
```

- Home Page 固定，点击 `#/plaza`；
- 祖先按 parent_id 从根到父；
- 当前只显示，`aria-current="page"`；
- 分隔符 `/`；
- 长标题 ellipsis。

## 加载

- 从 current.parent_id 逐级 `getItem`；
- `seen` 防环，最大 100；
- 请求失败保留已有 path，不阻塞正文；
- item.id/parent_id 变化时 alive guard。

## 导航

- 面包屑链接走 `ctx.navigate`；
- 没有自定义返回按钮；浏览器后退和 hash 路由负责返回。
- Manga/Image 的错误恢复按钮不算顶栏返回。

## UI

顶栏与 Sidebar 品牌共享 `--topbar-inset/--topbar-height`，中心线对齐。

## 相关

- [ItemView](item-view.md)
- [Designs](../designs.md)
