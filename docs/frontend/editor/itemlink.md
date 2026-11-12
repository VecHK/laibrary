# Itemlink

[itemlink.tsx](../../../packages/web/src/modules/itemlink.tsx)

## 两种链接

- 块级：`role='itemlink'`，`target_id`；
- 行内：text title 中的 `[[item:123]]` / `[[item:123|label]]`，纯文本 token。

## Block

- 显示目标 Item 的图标/标题/role；
- 点击走 `openItem`/open resolver；
- 目标删除后允许悬空，不级联删 itemlink。

## 选择器

- Slash `/link` 打开 ItemPicker；
- 排除当前占位行；
- 选中后创建 itemlink，替换占位符；
- 失败 reload。

## Inline

- `InlineText` 解析 token；
- 服务端写入时校验目标存在、拒绝自指；
- 不建 links 表/反链。

## 相关

- [Types and data model](../../item/01-data-model.md)
- [PageFull](page-full.md)
