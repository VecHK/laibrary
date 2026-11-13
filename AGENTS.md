# AGENTS.md

本文件面向所有在本仓库工作的 Agent。它约束你如何读文档、如何判断、如何改代码、如何验证，以及发现用户疏漏时如何提示。**它不替代领域文档**；领域事实以 `docs/glossary.md`、`DESIGN.md` 和 `docs/item/` 为准。

Laibrary 是一个“一切皆 Item”的个人数据基座；当前是 v2 POC，优先把数据基座做扎实，前端先服务“文本编辑 + 漫画阅读”，之后再扩展。数据可以丢弃，但**丢弃数据必须得到用户明确许可**。

## 阅读顺序

1. `AGENTS.md`
2. `README.md`
3. `docs/introduction.md`（完整文档索引）
4. 按任务需要读其他文档（`introduction` 应该有索引）

补充规则：

- 写代码前，必须读 [docs/methods.md](docs/methods.md)（编码硬规则）和 [docs/glossary.md](docs/glossary.md)（领域术语）；改前端必须先读 [docs/frontend/introduction.md](docs/frontend/introduction.md) 和 [docs/frontend/glossary.md](docs/frontend/glossary.md)。
- 改数据/API/数据库前，读 `DESIGN.md` 与对应的 `docs/item/01~06`。
- 改前端交互前，读 `DESIGN.md` §9 和 [docs/item/06-runtime.md](docs/item/06-runtime.md)。
- `docs/vision.md` 是北极星，不是当前实现规格；当前行为以 `DESIGN.md` 和 `docs/item/` 为准。
- 不要用旧聊天记忆、旧代码或旧文档覆盖 `glossary`/`DESIGN` 的术语和决策。

## 对用户疏漏的提示义务

用户可能疏忽、错漏或记不清。Agent 如果意识到用户存在这类问题，应根据严重程度主动提示，不要沉默。提示时要说清判断依据（代码路径、文档、测试结果、安全事实或可复现行为）。

分级：

- **贴士**：细节遗漏、存在可选项。例如文档索引漏链、测试命名不统一、某个可选 UX 还能更好。简短指出即可，不打断主任务。
- **提醒**：可能导致潜在 bug、体验或美学偏差。例如文本保存触发整页刷新、焦点丢失、移动端布局溢出、旧术语残留、配置放错层级。应说明影响和建议修法。
- **建议**：技术选型、代码实现、优化项。例如复用已有 helper、保持 keyset 分页、先做本地状态再做全局刷新、用现有 kind 机制而不是新增 role。给出取舍，不强制。
- **强烈建议**：安全问题，或继续这样下去项目会走向失控。例如无鉴权直接暴露公网、删库/删 blob 等破坏性操作、绕过 role/kind 契约、全表扫描破坏 3M 目标、无迁移却直接改 schema、把密钥写进 Item。**先提出风险和建议，不要越过用户直接执行。**

执行原则：

- 重大问题先停手、说明风险、给替代方案；用户明确确认后再做。
- 破坏性命令（`DROP SCHEMA`、`rm -rf storage`、清空开发库、终止用户进程）只有在用户明确要求时才可执行。
- 不把“数据可丢弃”理解为“可以随时替用户丢数据”。
- 发现文档与代码矛盾，先指出矛盾并以当前决策为准修正，不要悄悄让其中一方继续错误。
- 提示要具体、可执行，不写空泛的“建议优化”。

## 项目共识

- **一切皆 Item**：用户数据、系统配置都是 Item；单表 `items` 是事实源。
- **后端/数据基座优先**：当前先把模型、blob、配置、API 做稳；前端先完成 POC，不追求大而全。
- **组合根 + 闭包工厂**：server 不写 service class；web 不搞 RPC/标签模块单例。依赖从 App/组合根显式注入。
- **当前 POC 范围**：文本 block 编辑、inline itemlink、image/file、entity + manga 阅读、tags、database 基础、系统设置。
- **明确后置**：文件柜/SMB、富文本 marks、大纲缩进、反向链接、database 高级视图、派生/不可变数据库、Gāng、Public Space、Electron、鉴权/多用户、200 万数据导入。
- **规模目标**：最终约 300 万 Item；当前不做 3M 压测/导入，但不要引入全表扫描、无界根列表、同步大 JSON 处理等会堵死后路的写法。
- **单用户/局域网**：当前无鉴权、CORS 开放；不要声称它是公网安全产品，也不要擅自加半套认证。
- **无旧数据迁移**：v2 允许清库重建；但清库是破坏性操作，必须用户明确授权。

## 领域契约

这些是决策，不是建议：

- `role` 是闭集：`page / entity / text-block / text-heading-1 / text-heading-2 / text-heading-3 / text-list / text-todo / image / file / itemlink / tag / database`。文本编辑器专用 role 统一使用 `text-` 前缀；新的文本形态优先复用 text-* 体系。不要新增 role 绕过模型；非文本新内容类型用 `entity + kind`。
- `kind` 只属于 `entity`：`(role='entity') ⇔ (kind IS NOT NULL)`；page 永远没有 kind。
- 漫画不是 role：漫画 = `entity + kind=manga` + image children。
- 不要恢复 `custom`、`sys/type/*`、`sys/related/*`、`FileID`/`fid_`、`latest.json`。
- 文件是 `file`/`image` Item；字节是内容寻址 blob；`blob_id` 不可变，替换 = 新 blob + 新 Item。
- 缩略图是隐藏的 `thumbnails` 派生表，不是 Item；尺寸 96/384/800/1440 AVIF；删除 image 级联，thumb blob 由 GC 回收。
- `unity_name` 全局唯一、设置后不可变、`sys.` 保留；database 字段类型 `unity_name` 映射 item 列，不放进 attributes。
- `itemlink` 用 `target_id`；行内链接是 text-* block 的纯文本 token `[[item:123]]` / `[[item:123|label]]`；没有 links 表/反链。
- text-heading-1/2/3、text-list、text-todo 是文本编辑器专用 role；输入组件与 text-block 共用，Shift+Enter 同样只做块内换行。
- text-list 用 attributes.list_kind=bullet/number/alpha；text-todo 用 attributes.checked。列表/勾选快捷输入只允许在 trim 空的 text-block 上触发。
- `tag` 只做分类；title 大小写不敏感唯一。
- 配置分两层：bootstrap 只在根 `.env`/OS env；runtime 只在 `sys.config` Item；runtime 不接受 env 覆盖。
- 系统项（`sys.`）不出现在公共 listing，不能被通用 item 写接口修改/删除。
- 术语表是领域契约：领域术语先更新 `docs/glossary.md`，前端/编辑器术语更新 `docs/frontend/glossary.md`；不要发明同义词。
- 常量用 `__MODULE_NAME__`；Drizzle table、zod schema、React module descriptor 是模块 API 对象，保留其稳定接口名。

## 文档权威与冲突处理

按以下优先级理解：

1. 用户当前明确指令。
2. `docs/glossary.md` + `DESIGN.md` 的领域决策。
3. `docs/item/01~06` 的实现规格。
4. `docs/methods.md` 的编码硬规则。
5. `docs/vision.md` 的北极星意图。

发现冲突时：

- 先判断是“旧文档未更新”还是“新需求改变决策”。
- 不静默选一个；在交付说明里指出冲突和采用依据。
- 改变领域模型/API/schema 时，同步更新 `DESIGN.md`、相关 `docs/item/` 和索引；不要只改代码。

## 工作流

1. **先读再动手**：目标文件、邻近代码、相关规格和术语；不要凭记忆改。
2. **小步、最小 diff**：只改任务相关代码；不顺手重排、不批量格式化、不升级依赖。
3. **先方案后大改**：涉及 schema、role/kind、公开 API、数据迁移、安全边界、前端架构的大改，先给出方案和风险；普通 bugfix 可直接做。
4. **改行为就补测试**：先写能复现的用例，再修；纯函数/边界解析优先单测。
5. **验证再交付**：运行 lint、typecheck、test、web build；不通过不宣称完成。
6. **更新文档**：API/schema/交互/术语变更必须同步文档索引、规格和 glossary。
7. **不提交/不推送**，除非用户明确要求；不修改用户 `.env`、密钥、未授权数据。

收尾时必须说明：改了哪些文件、行为/API 变化、测试结果、偏离规则的地方、还没解决的问题。

## 编码规则

[docs/methods.md](docs/methods.md) 是硬规则。最重要的几条：

- 代码是一棵完整的树；不用 early return 剪断分支；同级互斥用 `else if`，父子层级用 `else { if }`；超过 4 层拆函数。
- 不写 class / `this`（错误类型例外）；用闭包工厂、对象字面量、函数组合。
- 状态只允许一个所有者；不导出可变绑定；不用模块级 `let`。
- 副作用集中到可数的点；纯函数优先；入参不可变。
- 不用 `continue` / `break`；查找用 `find`/抽函数。
- 命名：函数 camelCase、数据 snake_case、工厂 PascalCase、React 组件 PascalCase、hook `useX`；被写入的闭包状态 `__name`；导出数据值 `__VAR_NAME__`。
- 不用 `any`、不用 `!`、不滥用 `as`；外部数据用 `parseX` 收窄；品牌类型用于领域 ID。
- 空值默认 `null`；`undefined` 只用于语言强制的可选位置。
- `catch` 必须负责：包装并保留 `cause`、判别后真正处理，或不 catch；禁止静默吞掉。
- 顶层有统一兜底；错误只在兜底记录一次；并发错误用 `AggregateError`。
- 悬浮 Promise 必须 `await` / `void` / `.catch()`。
- 注释只解释“为什么”和“注意什么”；不写复述代码的注释。

当前生产代码已完成主体重构：server 不写 service class，web 无 RPC/标签模块单例，外部输入在边界 parse。**新代码必须遵守规则；发现新的历史例外时只在与改动直接相关的局部迁移，不做全仓重排。** 需要偏离时写 `// justify: <节号> <理由>` 并在交付说明列出。

## 前端交互契约

前端 POC 的目标是 Notion 式连续编辑，而不是“每改一个字整页刷新”。

- page 的 children 由 `PageFull` 本地持有；新增、删除、排序、文本修改先更新本地状态，必要时再后台持久化。
- 文本输入不调用全局 `ctx.refresh()`；`ItemView` 只在切换 item 时显示 loading，后台刷新不得清空当前 item。
- 页面编辑器不设置固定插入工具栏；插入走 `/`；block 控件只在 hover 时出现。
- 侧边栏树只包含 page/database/itemlink；只有 page 可展开，database/itemlink 是叶子。节点 `+` / `···` 按侧边栏规格实现；Trash 未实现前 Remove 只能永久删除空容器。
- 顶部导航只用 Breadcrumbs（Home Page / 祖先 / 当前）；首页进 plaza，祖先可点击，当前不可点；不实现自定义返回按钮，依赖 hash 路由和浏览器后退。
- 页面接受 OS 文件拖入：按 MIME/扩展名判断 image 或 file；外部纯文本拖入按空行规则拆成 text-block。
- Block 焦点：首/末视觉行上下键跨 block；Esc/handle 进入选中模式；内容区外 marquee 框选、内容区内保留普通文本选择；Shift+Arrow 扩展；批量删除 undo 使用 `deleteItems`/`restoreItems` 保持原 ID，历史仅页面内存。Shift+Click/Cmd+Click 不用于 block 多选。
- 保持焦点、caret 和滚动位置；不要因为保存/父级刷新让 text-block 重新挂载或跳回末尾。
- `/` 打开插入菜单（新页面（普通/创建后打开）/文本/一级标题/二级标题/三级标题/无序列表/数字列表/字母列表/待办事项/图片/附件/链接/漫画）；支持上下键、Enter、Esc、鼠标选择。
- Enter 在当前光标处拆行并聚焦新行；列表/勾选项 Enter 生成同类型下一项，右侧内容进入新项且 caret 在新项开头；Shift+Enter 软换行；空 text-block/heading 的 Backspace 删除并 focus 前一个 text block 末尾，空 list/todo 转 text-block；删除走 `deleteItems` 快照 + undo。
- 中文 IME composing 时不能误触发 Enter/斜杠命令。
- 链接选择器必须排除当前占位行，避免 itemlink 指向马上被删除的 Item。
- 未知 kind 统一提示“没有合适的打开方式”；不要偷偷降级成某种编辑器。
- 不引入 contenteditable/富文本/新编辑器依赖，除非用户明确批准并更新设计。
- 改前端交互必须做浏览器验证；只通过 typecheck/build 不算验证。

## 项目特有反模式

看到以下模式，先判断是否是 bug 或设计回退，不要照抄：

- 把 tag 当类型分发，或恢复 `sys/type/*`。
- 为**非文本**新内容类型新增 role，而不是 `entity + kind`；文本编辑器专用 role 必须使用 `text-` 前缀并复用 TextBlock 输入组件。
- 恢复 `FileID`/`fid_`，或把 blob 哈希塞进 attributes。
- 文本每次保存调用全局 `ctx.refresh()`，导致整页 loading/焦点丢失。
- 把文件字节、缩略图、系统配置行重复建模成另一套实体。
- 把 runtime 配置放进 env，或让 env 覆盖 `sys.config`。
- 在公共 listing 中暴露 `sys.%` 系统项。
- 为 3M 规模写无界根查询、全表 JSON 扫描或 N+1。
- `catch` 后只 toast 却继续假装成功；或吞掉错误返回空数组。
- 未经许可清库、删 storage、改迁移历史。
- 用“先做了再说”的方式改 role/kind/schema/公开 API。

## 完成定义

一个任务只有同时满足以下条件才算完成：

- 行为符合当前规格；公开 API/schema 变化已同步类型、文档和索引。
- 正常路径、边界情况和失败路径都有合理处理；没有静默吞错。
- 行为变更带测试；前端交互做了浏览器/headless 验证。
- `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build` 通过（或明确说明未跑原因）。
- 没有未授权的数据/配置/进程破坏，没有无关 diff。
- 交付说明列出改动文件、行为变化、验证结果、偏离项和遗留问题。

## 数据、API 与安全

- 只有服务端 API 能写数据；客户端不得直接连数据库或写文件。
- 新增/修改 API 必须同步 `@laibrary/types` 的 `ActionTable`、zod payload、客户端和文档。
- 保持 `Item` wire shape；不要恢复 `src`/`cover_src`/`image_width` 之类旧字段。
- blob 上传走 `POST /blob`；读取支持 Range/ETag；不要新增公共 blob 删除/替换接口。
- 3M 规模下避免：无界根 listing、全表 JSON 扫描、逐条 N+1、无索引过滤、同步处理大文件。
- 当前无鉴权，CORS 开放；**不要将 44998 直接暴露到公网**。Cloudflare Access/token 尚未实现，不要声称已有。
- 密钥只放 env/secret；不进 Item、不进日志、不写进文档。
- 任何删库、清 storage、清用户数据、改迁移历史的操作，都需要用户明确许可。

## 测试与验收

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

- 行为变更必须有测试；bugfix 先有回归用例。
- 纯函数/解析逻辑优先单测；前端交互至少做一次浏览器/headless Chrome 验证。
- server 测试需要 PostgreSQL；默认 `TEST_DATABASE_URL=postgres://root:root@127.0.0.1:5432/laibrary_test`；测试会重建测试 schema。
- 不要拿开发库当测试库跑 destructive 重置；开发数据即使是 POC 也可能有用户内容。
- 测试通过、lint/typecheck/build 通过后才能说“完成”；未跑就说未跑。
- 当前测试规模会变化，不要硬编码数量；以实际命令输出为准。

## 文档规则

- `docs/introduction.md` 是**完整文档索引**；新增/移动文档必须更新它。
- `README.md` 只放快速开始、当前能力和顶层入口，不复制完整规格。
- `DESIGN.md` 是决策记录；改变决策时更新它，而不是只改代码。
- `docs/methods.md` 是编码规则；不要把它改写成项目领域文档。
- `docs/glossary.md` 是领域术语唯一来源；前端/编辑器术语以 `docs/frontend/glossary.md` 为准；新增术语先改对应 glossary。
- `docs/vision.md` 只表达北极星；当前实现状态不要写进去冒充现状。
- 文档之间用相对链接；避免复制同一段事实。发现索引漏项或链接失效要主动修。

## 沟通风格

- 用用户当前使用的语言回复；本仓库默认中文。
- 直接说结论、依据、风险和下一步，不写空泛总结。
- 发现用户方案有问题时，先指出并给替代方案；不要沉默执行，也不要在重大问题上先斩后奏。
- 不把“计划”说成“已完成”；不把“静态检查通过”说成“浏览器验证通过”。

## 环境备注（会变化）

- Node 26.13.1（nvm，见 `.nvmrc`）、pnpm 12、PostgreSQL 18、drizzle、Hono、zod、sharp、React 19、Vite、Vitest。
- 默认 API `http://127.0.0.1:44998`，Web `http://127.0.0.1:5173`。
- bootstrap 在根 `.env`；`.env` 不提交；`config.json` 已移除。
- Docker 开发库与测试库分离；开发数据可能被用户继续使用。
- 依赖安装/网络受限时，按用户指示处理代理；不要假设某个代理一定可用，也不要把代理写进代码或配置。
