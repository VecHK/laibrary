# 焦点与 Caret

## Focus Request

父级不能直接操作 textarea ref。PageFull 用：

```ts
{
  id: ItemID
  request: { caret: number | 'end' }
}
```

TextBlock 在 focus_request 变化时：

1. focus textarea；
2. 计算 caret（clamp 到 value 长度）；
3. setSelectionRange；
4. 在 macrotask 再落一次 caret，避免 React controlled value 覆盖；
5. 调用 `onFocusHandled`。

## 进入编辑

- 点击 inactive TextBlock：若浏览器有文本 selection 则不激活，否则 `onActivate`；
- `focusBlock(id, caret)` 清空 selected_ids；
- `focusAdjacentBlock` 在首/末视觉行跨 block；
- `caretAtVisualEdge` 用镜像节点测量软换行，不只看 `\n`。

## 保持输入

- 不在每次输入 `ctx.refresh()`；
- 父级 patch title 不重挂载 TextBlock；
- blur 才 flush；
- 结构操作后明确设置 caret，不依赖默认。

## 相关

- [Keyboard](../reference/keyboard-map.md)
- [TextBlock](text-block.md)
- [Editor modes](../state/editor-modes.md)
