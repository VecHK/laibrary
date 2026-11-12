# Slash Menu

[text-block-editor.ts](../../../packages/web/src/lib/text-block-editor.ts)、[slash-menu.tsx](../../../packages/web/src/modules/slash-menu.tsx)

## 触发

`detectSlashQuery` 只在：

- 行首 `/`；
- caret 在行尾；
- 查询中无 `/`、无空白。

时返回 query。关闭方式：Esc、选择、失焦、输入不匹配。

## 命令模型

`SlashCommand`：

```ts
{ id, label, description, group, role, aliases, suffix? }
```

分组：`suggested`（建议）在前，`basic`（基础块）在后。`orderSlashCommands` 将命令按显示顺序展开；键盘选择索引和菜单视觉顺序一致。

## 默认选中

打开后 `selected_index = 0`，即显示顺序第一项（当前是“新页面”）。

## 新增页面

- 新页面：创建 child page block，留在当前页。
- 新页面【创建后打开】：创建后 `navigate(created.id)`。
- 两者都替换 `/` 占位 text-block，并保留 trailing text-block。

## 转换类命令

标题、列表、勾选、文本选择时：

- 清理占位文本；
- `convertTextBlock` 同 ID 更新 role/attributes；
- 保持焦点。

## 相关

- [TextBlock](text-block.md)
- [Text roles](text-roles.md)
- [PageFull](page-full.md)
