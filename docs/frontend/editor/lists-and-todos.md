# 列表与勾选项

## Role

- `text-list`：`attributes.list_kind = bullet | number | alpha`
- `text-todo`：`attributes.checked?: boolean`

两者都是 text role，共用 TextBlock / Shift+Enter / 输入 / undo / 选择。

## Marker

PageFull 对每个 `text-list` 计算：

- bullet：`•`
- number：连续同 kind 的 `1. 2. 3.`
- alpha：`a. b. c.`，超过 z 后 aa

marker 不在 title 中；列表排序/插入后自动重算。遇到非 list 或不同 kind 重置。

## 快捷输入

只在空 text-block 行首：

```text
-      -> bullet
1.     -> number
a.     -> alpha
[]     -> todo
【】   -> todo
```

前缀后的内容 trim 后必须为空。

## Checkbox

- todo 左侧 checkbox；
- 点击切换 checked；
- 点击不激活 TextBlock、不选择 block；
- checked 后正文删除线/变淡。

## Enter

- list：同 list_kind 新项；
- todo：未勾选新项；
- 光标处拆分，右侧进入新项；
- 新项 caret 0；
- 空项 Enter 也创建新项。

## 空 Backspace

- 空 list/todo Backspace：同 ID 转 text-block，清空 list/checked attributes；
- 不删除 Item；
- 非空 list/todo 沿用现有合并/删除逻辑。

## 相关

- [Text roles](text-roles.md)
- [Keyboard](keyboard.md)
- [TextBlock](text-block.md)
