# UI/UX 设计原则

> 这里只写**原则**。为什么这样设计、具体流程和失败处理放在对应 feature 文档；本文不重复实现细节。

## 1. 连续文本流

- 页面首先是连续文本，不是表单或卡片面板堆叠。
- 正文内容宽度保持约 `708px` 居中；页面标题 40px。
- 除 block 内容和必要控件外，不添加常驻边框、卡片背景或工具栏。

## 2. 控件按需出现

- Block gutter、插入按钮、菜单等只在 hover 或明确操作时出现。
- 空页面不堆叠多个入口；Slash 是主要插入方式。

## 3. 焦点与 caret 连续

- 保存、后台刷新、切换 block 不丢失焦点和 caret。
- 结构操作后必须明确决定焦点落点；不能依赖浏览器默认。
- 文本编辑优先使用 textarea；不引入 contenteditable 改变 caret 语义。

## 4. 三种交互模式必须可区分

- **编辑态**：有 textarea/caret。
- **Block 选中态**：一个或多个 block 高亮，键盘操作为 block 级。
- **文本选择**：浏览器原生 selection，只选文字，不选 block。
- 三种模式不允许同时激活。

## 5. 键盘优先

- Enter、Shift+Enter、Backspace、Esc、方向键、Delete、Cmd/Ctrl+Z 都必须有确定行为。
- 快捷键只在当前模式有意义时生效；不跨模式偷键。
- 任何 destructive 键盘操作必须可预测，并尽可能进入 undo。

## 6. Slash 是主插入入口

- `/` 打开按组排列的命令菜单。
- 默认选中当前显示顺序的第一项。
- 菜单选择只改变 block role/attributes 或插入明确的新 Item，不通过隐藏副作用工作。

## 7. 直接操作优先

- 能拖拽、点击、就地编辑完成的，不要求打开对话框。
- 拖拽必须显示插入位置；文件、文本、block 的 drop 规则必须区分。
- 删除/选中操作优先在原文位置反馈。

## 8. 空 Block 行为可预测

- 空文本 block 的 Backspace 删除当前 block 并把 caret 放到前一个文本 block 末尾。
- 空 list/todo 的 Backspace 取消列表/勾选格式，而不是直接删除。
- 没有可落点的前一个文本 block 时不误删。
- 结构删除必须进入页面 undo 历史。

## 9. 局部保存，不整页刷新

- 文本、属性、排序先更新本地状态，再后台持久化。
- 不在每次输入时调用全局 refresh。
- 保存失败必须可见，并保留重载/恢复路径。

## 10. 失败可见

- 上传、RPC、恢复、转换失败不能静默吞掉。
- 错误提示说明操作和后果；需要时 reload 当前 children。

## 11. Text Role 一致

- `text-*` role 共用 TextBlock 输入体验。
- 标题、列表、勾选项只在 typography、marker、checkbox、快捷转换上不同。
- 不为同一文本输入行为复制第二套编辑器。

## 12. 可访问与响应式

- 交互控件有可读 label/ARIA；键盘可达。
- 窄窗口不溢出；控件不依赖 hover 才能完成核心编辑。
- 颜色/字号层级保持稳定，不以动画替代状态。

## 详细文档

- [PageFull](editor/page-full.md)
- [TextBlock](editor/text-block.md)
- [文本选择与 block 选中](editor/selection.md)
- [键盘映射](reference/keyboard-map.md)
- [Accessibility](mechanisms/accessibility.md)
