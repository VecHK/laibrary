# Text Roles

## Role 表

| role | 用途 | attributes |
|---|---|---|
| `text-block` | 普通文本 | 任意 |
| `text-heading-1/2/3` | 标题 | 空 |
| `text-list` | 列表 | `list_kind`: bullet/number/alpha |
| `text-todo` | 勾选 | `checked`: boolean |

所有 role 都由同一 `TextBlock` 渲染，role 决定 typography、marker/checkbox 和转换入口。

## 转换

`convertTextBlock` 在 text-* role 间同 ID 转换，可原子更新 title/attributes：

- Slash 标题/列表/勾选；
- `# `、`- `、`1. `、`a. `、`[] `、`【】 ` 快捷；
- 空 list/todo Backspace → text-block。

## 为什么独立 role

- 标题/列表/勾选在输入上相同，但在 Item 的语义、快捷键和显示上不同；
- 避免把 list_kind/checked 塞进 text-block 形成多态超级对象；
- 与 Notion/AppFlowy 的 block type 思路一致；共享的是 UI 组件，不是 role。

## 相关

- [Lists/todos](lists-and-todos.md)
- [Slash menu](slash-menu.md)
- [Glossary](../glossary.md)
