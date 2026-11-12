# Laibrary 引言

## 一句话

Laibrary 把你在电脑上做的那些事——存东西、整理东西、找东西——统一成同一种做法：一切都变成一条可以读、可以改的“Item”。任何程序、任何语言都能访问和编辑它；数据不再属于某个 App。

## 起源

Laibrary 不是笔记软件，不是文件管理器，也不是传统的数据库。它是一个与文件系统平级的信息组织系统。核心理念来自第一性原理：**把数据从无序转换为有序（熵减）**。为此它重新定义数据、逻辑与副作用的关系。

## 第一性原理：熵减

我们操作电脑，做的工作基本是两件事：

1. 把数据从无序弄成有序——复制一段话存进笔记、下载图片并重命名。
2. 把数据从一种有序结构提取出来，加工后放进另一种结构——处理表格后复制到字处理软件。

这两件事在传统工具里都是手工劳动，而且每一步都被 App 的私有格式切割。Laibrary 让它们变成对**结构化数据的直接读写**：数据本身有序地待着，规则持续维持秩序，语义判断帮助找东西。

| 角色 | 现在（v2 POC） | 未来 |
|---|---|---|
| **数据** | Item（role + kind + attributes + 树/tags/blob） | 同左 |
| **逻辑** | 客户端 kind 模块（inlineIcon/Card/Full/opener） | Gāng（信息治序引擎，待验证） |
| **副作用** | HTTP 写操作（仅服务端 API） | Clerk（事务化副作用，待验证） |

## 三大支柱

### 1. 基座：打破 App 边界的数据层

- **打破数据孤岛**：一切皆 Item。结构化数据（attributes JSONB）在 PostgreSQL；title/tags/树/日期是独立列；文件是 file/image Item，二进制是内容寻址的 blob。
- **任何语言、任何程序都可以访问和编辑**：RPC + 文件路由；未来加 token/权限，但“数据对客户端开放”是原则。
- **高性能与高并发**：全异步、SQL 索引、keyset 分页、内容寻址 blob；不回到“内存索引 + 单线程扫描”。

> 早期探索 `myrepository` 的教训（180 万 Item 阻塞单线程）被继承；代码不沿用。

### 2. 灵魂：Gāng（纲）—— 信息治序引擎

> `[Todo/待验证]` 规格留待 `docs/gang/`。当前未实现。

- **语义判断（Judgement）**：用自然语言定义判断标准，由 LLM 执行。
- **DSL 与 Runtime（Task & Routine）**：声明式 JSON，单向 next，Map/Filter/Reduce。
- **副作用隔离（Clerk）**：Routine 纯函数；写入/命令/HTTP 交给事务化的 Clerk。

### 3. 生态：能力的组合

- 第一方工具 BPlayer、manfa、lAI、whatsNews 等共享数据层。
- Gāng 是通用 JSON，LLM 可生成 GangDef 模板。
- 新内容类型 = `entity + kind` + 客户端 kind 模块；不新增 role、不改基座。

## 设计原则

- **P0 第一性原理**：由熵减推演，不按功能清单。
- **P1 一切皆 Item**：用户数据、系统配置都是 Item；语义数据单表。
- **P2 基座管事实，客户端管呈现**：服务端只理解 role；kind 是开集，由客户端模块解释。
- **P3 类型进运行时**：zod 在 API 边界；BlobID/unity_name 有运行期格式与约束。
- **P4 最小系统验证，约定优于机制**：itemlink/token 先用约定；links 表/反链后置。
- **P5 结构化数据 + 强校验**：坏数据进不了库；文件必须指向存在的 blob。
- **P6 高性能**：索引、keyset、内容寻址、批量 GC；不为 3M 规模做 premature sharding。
- **P7 前后端分离、RPC 全类型化**：`@laibrary/types` 是唯一事实源。

## 与其他工具的区别

| | 数据归属 | 格式与逻辑 | 开放程度 |
|---|---|---|---|
| 文件系统 | 文件归系统，解释归 App | 二进制 + 私有格式 | 文件名/目录是唯一公共层 |
| Notion / Obsidian | 数据锁在服务内 | 私有结构，视图与数据耦合 | 封闭，定制靠插件 |
| 数据库应用 | 表结构由应用独占 | 强 schema，逻辑在应用层 | 只对 SQL 客户端开放 |
| 媒体库（plex 类） | 媒体+元数据归单一应用 | 单一领域，逻辑私有 | 封闭生态 |
| **Laibrary** | **数据是公共基座，不属于任何 App** | **一切皆 Item，role+kind，结构化 JSONB** | **任何程序可访问；逻辑可插拔** |

## 当前实现边界（v2 POC）

已实现：单表 Item、role/kind、unity_name、itemlink、inline token、blobs、thumbnails、系统配置、page/text-block/text-heading-1/2/3/text-list/text-todo/image/file/entity/manga、`/` 插入菜单、标题/列表/勾选快捷输入、Enter 拆行、设置页。

暂未实现：富文本/marks、大纲/反链、文件柜/SMB、database 高级视图、派生数据库、Gāng、Public Space、鉴权/多用户、Electron、200 万导入。

## 推荐阅读顺序

1. [AGENTS.md](../AGENTS.md)：Agent 工作协议、领域契约、提示义务。
2. [README.md](../README.md)：快速开始、当前能力、暂未实现。
3. **本文件**：完整文档索引、项目原则和阅读路线。
4. 按任务读其他文档；写代码前至少读 [methods.md](methods.md) 与 [glossary.md](glossary.md)。

## 完整文档索引

### 入口与决策

| 文档 | 内容 | 什么时候读 |
|---|---|---|
| [AGENTS.md](../AGENTS.md) | Agent 工作协议、用户疏漏提示义务、工程/安全/文档规则 | 每个任务开始 |
| [README.md](../README.md) | 快速开始、配置入口、当前能力、暂未实现 | 了解项目与运行 |
| [DESIGN.md](../DESIGN.md) | 概览、核心决策、当前状态、文档地图 | 做任何设计判断前 |
| [glossary.md](glossary.md) | **名词表（术语唯一来源）** | 每个任务；新增术语先改这里 |
| [vision.md](vision.md) | 使用愿景/北极星 | 理解长期方向；不当作当前规格 |

### 前端实现规格

| 文档 | 内容 | 什么时候读 |
|---|---|---|
| [frontend/introduction.md](frontend/introduction.md) | 前端文档入口、目录、阅读顺序 | 改 `packages/web` 前 |
| [frontend/designs.md](frontend/designs.md) | UI/UX 原则 | 做交互/视觉设计前 |
| [frontend/glossary.md](frontend/glossary.md) | 编辑器/前端术语，Item/Block/TextBlock 区分 | 改编辑器前必读 |
| [frontend/architecture.md](frontend/architecture.md) | App shell、session、路由、模块 registry | 改前端结构前 |
| [frontend/state/](frontend/state/) | session、PageFull、模式、undo | 改状态/保存/历史 |
| [frontend/editor/](frontend/editor/) | PageFull、PageBlock、TextBlock、role、选择、粘贴、媒体 | 改编辑器 block |
| [frontend/views/](frontend/views/) | Sidebar、Breadcrumbs、Plaza、Settings、SidePeek | 改页面区域 |
| [frontend/mechanisms/](frontend/mechanisms/) | 错误、blob、配置、标签、可访问性、性能、测试 | 改横切机制 |
| [frontend/reference/file-map.md](frontend/reference/file-map.md) | 前端文件到文档映射 | 找模块/新增文件 |

### 后端实现规格

| 文档 | 内容 | 什么时候读 |
|---|---|---|
| [item/01-data-model.md](item/01-data-model.md) | Item、role/kind、树、tags、itemlink、unity_name | 改数据模型/仓储/前端字段 |
| [item/02-file-system.md](item/02-file-system.md) | blob 内容寻址、上传/读取、GC、thumbnails | 改文件、图片、缩略图 |
| [item/03-repository.md](item/03-repository.md) | 创建/更新/删除、listing、排序/keyset、校验 | 改 API 行为或查询 |
| [item/04-api.md](item/04-api.md) | Action 列表、payload、文件路由、错误码 | 改 API/客户端调用 |
| [item/05-database.md](item/05-database.md) | schema、索引、迁移、测试库重置 | 改表/索引/迁移 |
| [item/06-runtime.md](item/06-runtime.md) | bootstrap/runtime 配置、启动、CLI、测试、Web | 改配置/启动/前端交互 |

### 编程方法论：`docs/methods.md`

[docs/methods.md](methods.md) 是 TypeScript 编码硬规则，不是可读可不读的风格文章。它规定“为什么这样写”，并给出 Agent 工作协议。规则效力：文中“必须/不要”是硬规则；偏离要写 `// justify: <节号> <理由>` 并在交付说明列出。

| 节 | 主题 | 建议时机 |
|---|---|---|
| 零 | 开工前先查术语表 | 每次写代码前 |
| 总纲 | 六条代码观：树、组合、显式上下文、副作用、类型、单一所有者 | 先建立判断框架 |
| 一 | 控制流是树，不用 early return 剪断分支 | 写分支/重构函数 |
| 二 | 无类、无 this、组合优于封装 | 设计状态/模块 |
| 三 | 副作用集中、可控；状态单一所有者 | 写 I/O、闭包、状态 |
| 四 | 循环结构化，不用 continue/break | 写循环/扫描 |
| 五 | 命名即契约（函数/数据/工厂/作用域） | 命名、评审 |
| 六 | 类型把约束写进语言（any/!/品牌/可辨识联合/边界 parse） | 设计类型/API |
| 七 | 函数设计（对象参数、无布尔参数、组合、单一职责） | 写函数签名 |
| 八 | 模块与边界（组合根、无模块级副作用、无循环依赖） | 拆模块/入口 |
| 九 | 异步与错误（catch 必须负责、cause、顶层兜底、Result） | 写异步/I/O |
| 十 | 注释只解释为什么/注意什么 | 写注释/评审 |
| 十一 | 行为变更必须有测试 | 每次行为改动 |
| 十二 | 评审自查与 Agent 工作协议 | 开工前/提交前 |
| 附录 A | 改造速查表 | 重构/自查 |

### 按任务选读

- **改数据模型/仓储**：`DESIGN` → `glossary` → `item/01` → `item/03` → `methods`。
- **改文件/缩略图/GC**：`item/02` → `item/03` → `methods` §3/§9。
- **改 API/客户端类型**：`item/04` → `item/01` → `methods` §6/§9。
- **改数据库/迁移/索引**：`item/05` → `item/01` → `DESIGN` 决策记录。
- **改配置/启动**：`item/06` → `DESIGN` §7。
- **改前端交互**：`DESIGN` §9 → `item/06` → `methods`；必须做浏览器验证。
- **只写文档**：`AGENTS` → 本文件 → 对应规格；术语先查 `glossary`。

## 术语

统一使用 [glossary.md](glossary.md)：Item、Role、Kind、Entity、Page、Text Block、Text Heading、Itemlink、Tag、Database、Unity Name、Blob、BlobID、Thumbnail、Opener、Inline Itemlink、Bootstrap/Runtime Config、Gāng、Public Space、File Cabinet。

## 路线图

v2 之后：200 万导入与压测、鉴权/token、多用户/协作、Cloudflare Access 验证、文件柜、富文本、database 高级视图、派生数据库、Gāng、Public Space、Electron。
