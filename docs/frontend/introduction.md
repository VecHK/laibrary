# 前端文档引言

> 这是 `packages/web` 的入口文档。领域模型、API、数据库仍以根目录 `AGENTS.md`、`DESIGN.md`、`docs/item/` 为准；前端/编辑器术语见 [glossary.md](glossary.md)。

## 目的

这组文档面向两类读者：

- 人类监督者：理解前端有哪些区域、状态由谁拥有、关键交互为什么这样设计；
- 修改前端的工程师/Agent：知道该读哪份文档、改哪个模块、做哪些验证。

## 阅读顺序

1. [designs.md](designs.md)：UI/UX 原则（只有规则，不展开 why）。
2. [glossary.md](glossary.md)：编辑器术语，先区分 Item / Block / TextBlock / Role。
3. [architecture.md](architecture.md)：组合根、路由、session、模块 registry。
4. [state/](state/)：session、PageFull、模式、undo。
5. [editor/](editor/)：编辑器区域与所有 block 模块。
6. [views/](views/)：页面壳、侧边栏、Breadcrumbs、Plaza、Settings、SidePeek。
7. [mechanisms/](mechanisms/)：错误、blob、配置、标签、可访问性、性能、测试。
8. [reference/file-map.md](reference/file-map.md)：`packages/web/src` 文件到文档的映射。

## 目录地图

```text
packages/web/src/
  App.tsx / main.tsx      应用组合根、session、路由
  views/                  页面壳与页面区域
  modules/                Item 模块与编辑器 block 呈现
  lib/                    纯函数、RPC/URL、文本/媒体 helper
  style.css              全局布局、编辑器、组件样式
```

## 文档组织约定

- **designs.md** 只列原则；具体设计取舍写在 feature/module 文档的“为什么”段。
- **editor/** 是编辑器区域的主文档，按 Block/Text/Selection/… 拆分。
- **views/** 覆盖页面壳和非编辑器区域。
- **mechanisms/** 覆盖跨区域的副作用、数据流和验证。
- **reference/file-map.md** 必须覆盖所有源文件；新增模块要同步映射。
- 文档中的“必须/不要”是当前约定；偏离需要更新文档而不是静默改变。
- 术语以 [glossary.md](glossary.md) 为前端唯一来源；领域术语以根 `docs/glossary.md` 为准。

## 当前实现边界

- 纯文本编辑器，无 contenteditable/富文本 marks。
- Page children 由 PageFull 本地持有；不是全局 store。
- Undo 目前是页面内存级、结构删除优先；不是完整 command journal。
- 无 Trash、无嵌套列表、无协作、无鉴权。
- 当前运行方式：`pnpm web`（Vite 5173）+ API 44998。

## 相关文档

- [根 AGENTS.md](../../AGENTS.md)
- [根 DESIGN.md](../../DESIGN.md)
- [运行时规格](../item/06-runtime.md)
- [领域术语](../glossary.md)
