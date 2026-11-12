# Entity / Manga

[entity.tsx](../../../packages/web/src/modules/entity.tsx)、[manga.tsx](../../../packages/web/src/modules/manga.tsx)

## Entity

`role='entity'` + `kind`：

- 服务端只存 kind 字符串；
- 客户端 `kind_modules` 选择 Presenter/Block；
- 未知 kind 提示“没有合适的打开方式”。

## Manga

`entity + kind=manga`，children 是 image items。

- 阅读器 RTL/LTR；
- 懒加载页面；
- 本地阅读进度；
- toolbar：添加页；
- 不把漫画做成 role。

## 为什么不新增 role

漫画已有 `entity+kind` 扩展点；role 只表示存储/校验形态。新增内容类型优先使用 kind（非文本场景）。

## 相关

- [Module registry](../architecture.md)
- [Image](image.md)
