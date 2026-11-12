# TextBlock

[text-block.tsx](../../../packages/web/src/modules/text-block.tsx)

## 职责

`TextBlock` 是所有 text role 的共享输入组件：

- `text-block`
- `text-heading-1/2/3`
- `text-list`
- `text-todo`

不是 role；role 在 item 上。TextBlock 不拥有 Item，也不决定数据库结构。

## 渲染

```text
text-block [role] [is-active|is-empty] [has-prefix] [is-checked]
  marker / checkbox（list/todo）
  text-block-view（inactive）
  或 textarea（active）
  SlashMenu
```

- active 使用 textarea，自动增高；
- inactive 使用 view + InlineText；
- list/todo 前缀固定定位，不改变行高度；
- todo checkbox 点击不激活 textarea；
- checked 时正文删除线。

## 文本状态

- `value`/`value_ref` 本地持有 title；
- 400ms debounce 保存；
- `write_chain_ref` 串行化 `updateItem`；
- blur flush；
- item.id/title 变化同步本地，避免父级刷新覆盖输入。

## 键盘/快捷

- Enter 拆分由父级 `onSplit` 决定新 block role；
- Shift+Enter 原生软换行；
- Backspace 行首交给父级；
- Arrow 在首/末视觉行跨 block；
- Escape 进入 block 选中；
- Slash 打开菜单；
- heading/list/todo 空格快捷由纯函数检测。

## 高度

- `.text-block` 固定 padding/min-height；
- view/textarea 继承同一 font/line-height；
- textarea 自动 height 使用 scrollHeight；
- active/inactive 必须一致，避免输入抖动。

## 为什么

标题、列表、勾选和普通文本共享同一套 caret/textarea/IME/undo 语义；为每种 role 复制编辑器会造成行为和高度漂移。

## 相关

- [Text roles](text-roles.md)
- [Keyboard](keyboard.md)
- [Lists/todos](lists-and-todos.md)
- [Paste/drop](paste-and-drop.md)
