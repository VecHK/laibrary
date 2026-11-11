# 前端/编辑器术语表

> 领域术语以根 [glossary.md](../glossary.md) 为准；前端/编辑器专用术语以本表为准。代码、UI、文档出现冲突时先改本表或根表，再改实现。

## Item / Block / 界面

| 术语 | 定义 | 不是什么 |
|---|---|---|
| **Item** | 数据库中的一行，拥有 id/role/kind/title/attributes/parent/order 等。 | 不是任意 UI 组件；不是 DOM 节点。 |
| **Block** | 编辑器把 page/entity 的直接子 Item 排成的一行内容。 | 不是所有 Item；page 标题不是 block；tag 不是 block。 |
| **PageBlock** | 包住 block 内容的外壳：gutter、hover、选中、拖拽、插入线。 | 不是 Item 本身；不是模块 Content。 |
| **PageFull** | 页面编辑器：标题头 + children 列表 + 页面级状态。 | 不是单个 block；不是 ItemView。 |
| **Page Header** | 页面图标和标题输入区域。 | 不是 block；不参与 block 选择。 |
| **ItemContent** | ItemView 中承载模块 Presenter 的区域。 | 不是 PageFull 专属。 |
| **Module** | `ItemModule`：Presenter（Card/Full）和可选 Block。 | 不是 role 列表；不是编辑器状态。 |
| **Module Registry** | role/kind 到 ItemModule 的显式注册表。 | 不是全局 service；不是 RPC client。 |
| **Presenter** | 模块提供的 Card/Full 渲染器。 | 不是 block 的输入组件。 |
| **Module Block** | 模块提供的 block 呈现（如 image/file/itemlink）。 | 不等于 PageBlock 外壳。 |

## 文本编辑器

| 术语 | 定义 | 不是什么 |
|---|---|---|
| **Text Role** | `text-block` / `text-heading-*` / `text-list` / `text-todo` 等文本编辑器专用 role。 | 不是 TextBlock 组件；不是 kind。 |
| **TextBlock** | 所有 Text Role 共用的输入组件，包含 textarea、view、marker/checkbox、slash。 | 不是 role；不是数据库表。 |
| **Editing Block** | 当前拥有 textarea、准备接收文本输入的 block。 | 不是所有 selected block。 |
| **Active Block** | `active_block_id` 指向的编辑中 block。 | 不是浏览器 focus 的泛化同义词。 |
| **Focus Request** | 父级要求某 block 获得 focus/caret 的命令对象。 | 不是 DOM focus event。 |
| **Caret** | textarea 的 selectionStart/End；由文本输入维护。 | 不是 block 选中。 |
| **Text Selection** | 浏览器原生文字选区。 | 不是 block 多选。 |
| **Block Selection** | 一个或多个 block 被浅蓝高亮，支持 block 级键盘操作。 | 不是文字选区。 |
| **Selection Anchor** | Shift+Arrow 范围选择的固定端。 | 不是 caret。 |
| **Selected IDs** | 当前 block 选中集合。 | 不是 selected text。 |
| **Marquee** | 从 `.page-full` 外拖出的矩形框选。 | 不是正文内文本选择。 |
| **Marker** | list 左侧显示的前缀：`•`、`1.`、`a.`。 | 不属于 title；不可编辑。 |
| **List Kind** | `text-list` 的 `attributes.list_kind`：bullet/number/alpha。 | 不是 role。 |
| **Checkbox** | todo 左侧的完成状态控件。 | 不是 marker。 |
| **Structural Undo** | 页面级删除/结构操作历史。 | 不是 textarea 原生文字 undo。 |
| **Native Text Undo** | 浏览器 textarea 对文字输入/删除的历史。 | 不是 block 删除历史。 |
| **Slash Query** | 以 `/` 开头、行尾的菜单查询文本。 | 不是普通文本。 |
| **Slash Menu** | 按组展示的插入命令菜单。 | 不是 ItemPicker。 |
| **Save Queue** | TextBlock 串行化 title 写入的 Promise 链。 | 不是全页刷新。 |
| **Dirty** | 本地已改但尚未被服务端确认的状态。 | 不是浏览器 navigation dirty。 |

## 页面与导航

| 术语 | 定义 | 不是什么 |
|---|---|---|
| **Breadcrumbs** | Home Page / 祖先 / 当前页面的导航。 | 不是自定义返回按钮。 |
| **Home Page** | Breadcrumbs 固定首项，进入 `#/plaza`。 | 不是 Item。 |
| **Side Peek** | 右侧预览面板，复用 ItemView/PageFull。 | 不是路由页面。 |
| **Drop Indicator** | block before/after 的插入线。 | 不是 block 选中。 |

## 术语规则

1. 说“block”时，先说它是 **Item 的编辑器呈现**，不要直接把 Item 叫 block。
2. Page 标题不是 block；inline itemlink token 不是 block；tag 不是 block。
3. **TextBlock 是组件名**，**text-block 是 role 字符串**；不要把两者混用。
4. **Block Selection** 与 **Text Selection** 必须明确区分。
5. **Structural Undo** 与 **Native Text Undo** 必须明确区分。
6. 新增前端术语先改本表；新增领域术语先改根 glossary。
