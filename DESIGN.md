# Laibrary 设计文档

Laibrary 是一个“一切皆 Item”的个人数据基座。结构化数据、文件、页面、漫画、数据库、系统配置都统一成 Item；二进制字节存放在内容寻址的 blob 池；Item 的 **role** 决定基座行为，**kind** 决定客户端如何呈现/打开。

> 本文是**概览与决策记录**（为什么 + 当前实现）。术语见 [docs/glossary.md](docs/glossary.md)；实现规格见 [docs/item/01~06](docs/item/01-data-model.md)；愿景见 [docs/introduction.md](docs/introduction.md) 与 [docs/vision.md](docs/vision.md)。

## 1. 核心模型

只有一张 `items` 表（PostgreSQL）：

| 列 | 说明 |
|---|---|
| `id` | bigserial，对外 number |
| `role` | 存储形态，闭集，见 §2 |
| `kind` | 语义类型/opener，仅 entity 非空 |
| `unity_name` | 可选全局唯一机器名，`sys.` 保留 |
| `title` | 显示名；text-block 的内容；tag 的名字 |
| `attributes` | JSONB，随 role 变化 |
| `tags` | tag item id 数组，无 FK，清扫式维护 |
| `parent_id` | 单父树 |
| `order_index` | 兄弟排序，分数索引 |
| `blob_id` | file/image 的 blob 引用 |
| `target_id` | itemlink 的目标 ItemID |
| `create_date` / `update_date` | 服务端维护 |

数据库约束：

- `role ∈ ('page','entity','text-block','text-heading-1','text-heading-2','text-heading-3','image','file','itemlink','tag','database')`
- `(role='entity') ⇔ (kind IS NOT NULL)`
- `(role='itemlink') ⇔ (target_id IS NOT NULL)`
- `(role IN ('file','image')) ⇔ (blob_id IS NOT NULL)`
- attributes 必须是 JSON object；tags 不含 NULL；order_index 有限

## 2. Role 与 Kind

| role | kind | 含义 |
|---|---|---|
| `page` | 必须 NULL | 普通页面/block 容器 |
| `entity` | 必须非空 | 带 kind 的复合/插件内容，如漫画 |
| `text-block` | NULL | 纯文本 block |
| `text-heading-1` | NULL | 一级标题，文本编辑器专用 |
| `text-heading-2` | NULL | 二级标题，文本编辑器专用 |
| `text-heading-3` | NULL | 三级标题，文本编辑器专用 |
| `image` | NULL | 图片 Item，指向 blob |
| `file` | NULL | 普通附件 Item，指向 blob |
| `itemlink` | NULL | 指向另一个 Item 的链接块 |
| `tag` | NULL | 用户标签 |
| `database` | NULL | schema + 行 |

**kind 只属于 entity。** 漫画不是 role：漫画 = `entity + kind=manga` + image 子项。服务端不认识 kind，只存字符串；客户端 kind 模块决定 inlineIcon、Card、Full。未知 kind 提示“没有合适的打开方式”。

tag 只做用户分类；`sys/type/*`、`custom`、`sys/related/*` 已移除。

## 3. Itemlink 与 inline token

- 块级：`role='itemlink'`，`target_id` 列；写入时校验目标存在且非自己；目标删除后允许悬空。
- 行内：text-block 的 title 中的 `[[item:123]]` / `[[item:123|标签]]`；纯文本 token，不是富文本；`\[[` 转义；服务端写入时解析校验。
- 统一 open resolver：itemlink 跟随、page 打开页面、entity 按 kind、image/file/database/tag 按 role；找不到提示“没有合适的打开方式”。
- 不做反向链接、不做大纲缩进。

## 4. 文件与 blob

- 文件是 **file/image Item**，不是 `fid_` 字符串。
- `blobs`：`id`（SHA-256 hex）、size、mime、width/height、create_date；磁盘路径 `BLOB_PATH/<hash[0:2]>/<hash[2:4]>/<hash>`。
- 上传：临时文件 → hash → 去重 → 原子 rename → 写 blobs 行；返回 BlobMeta。
- file/image 有 `blob_id`；attributes 只有 filename；图片尺寸/MIME/size 来自 blob。
- 读取 `/blob/:id`：ETag、Range、immutable cache。
- 替换内容 = 新 blob + 新 Item；image 的 blob 创建后不可变。
- 无 `fid_`、无 `latest.json`、无序号分配器、无全表 JSON 深扫。
- 自定义内容需要文件 → 子 file/image Item。
- 文件柜是未来的外部文件连接器，不复用 blob。

## 5. 缩略图

- `thumbnails` 表：`(image_id, size)` PK、`blob_id`、width/height、create_date；FK image ON DELETE CASCADE。
- 尺寸固定 96/384/800/1440，AVIF；最大边、保持比例、不放大。
- `GET /thumb/:image_id?size=` 惰性生成；单实例进程内 per-key 去重；成功行才落库。
- 缩略图不是 Item，隐藏；不是 item 的 cover。image 不再有 cover 字段。
- 删除 image 级联删 thumbnails；thumb blob 由 GC 回收。

## 6. Unity Name

- `items.unity_name` 可选、全局唯一（partial unique），小写 slug，`sys.` 保留。
- 设置后不可变；title 可改。
- database schema 字段类型 `unity_name`：最多一个，映射 item 列，不进 attributes。
- 用途：系统配置 key、插件根、第三方按名查找。itemlink 仍用 ItemID；unity name 不是外键。
- `getItemByUnityName` 查询；公共 listing 默认排除 `sys.%`。

## 7. 系统配置

- **Bootstrap**：`.env`/OS env，启动前必需：DB URL、端口、host、storage/blob 路径、日志级别、migrate 开关；密钥只在这里。
- **Runtime**：`sys.config` database Item；配置行是 `page` Item，`unity_name='sys.config.*'`，attributes `{value,type}`；ConfigStore 读取、合并默认、zod 校验、缓存。
- `getConfig` / `updateConfig` action；设置页编辑。
- 通用 item 写接口禁止 `sys.` unity_name；系统项不出现在公共 listing。
- runtime 不接受 env 覆盖；bootstrap 不进入 Item。

## 8. API

- `POST /action`：`{ action, payload }`，成功 JSON，错误 `{ message, code, issues? }`。
- Actions：`addItem/getItem/getItems/updateItem/deleteItem/deleteItems/restoreItems/convertTextBlock/listing/getItemByUnityName/newTag/updateTag/deleteTag/searchTag/getTagByTitle/getConfig/updateConfig`。
- 文件路由：`POST /blob`、`GET/HEAD /blob/:id`；缩略图 `GET /thumb/:image_id?size=`。
- CORS 开放；鉴权属未来。
- 详细规格见 [docs/item/04-api.md](docs/item/04-api.md)。

## 9. 前端

- React 19 + Vite；hash 路由 `#/plaza`、`#/item/:id`、`#/settings`。
- 连接页设置 API baseurl（localStorage）。
- page block 编辑器：text-block / text-heading-1/2/3 / image / file / itemlink / entity；所有 text-* 共用 TextBlock 输入组件。无固定工具栏，`/` 分组插入菜单、Enter 拆行、Shift+Enter 软换行；hover gutter + block 菜单；文本编辑不触发整页刷新。
- 页面视觉：正文 `708px` 居中、标题 40px；无每行白框、无常驻删除按钮；左侧 hover 显示 `＋` 和拖拽把手。
- 顶部导航：`🏠 Home Page / 祖先页面 / 当前页面` Breadcrumbs；Home Page 指向 plaza，祖先可点击，当前不可点；不显示自定义返回按钮，浏览器后退继续可用。顶栏统一 `--topbar-inset/--topbar-height`，侧边栏 `Laibrary` 与 Breadcrumbs 垂直中心对齐。
- Block 焦点：text-block 首/末视觉行上下键跨 block；Esc/handle 进入选中模式；只在 `.page-full` 外 marquee 框选，内容区内保留普通文本选择；Shift+Arrow 扩展；Del/Backspace 批量删除；不使用 Shift+Click/Cmd+Click 多选。
- 批量删除 undo/redo 使用 `deleteItems`/`restoreItems` 快照与显式原 ID 恢复；仅页面内存历史，不做 Trash。
- 图片 block：左右拖拽等比缩放（宽度 80–1440px）、Alignment/Caption/Expand/Download 浮层、双击/Expand 打开 lightbox；放大预加载更高缩略图，缩小不请求更小图。
- 页面支持从 OS 拖入文件：`image/*` 创建 image，其余创建 file；多文件保持顺序，按目标 block 的 before/after 插入（空白处追加到末尾），并补一条空 text-block。
- 外部纯文本拖入/粘贴：每个非空行一个 text-block；内容行之间 1 个空行忽略，>=2 个空行生成一个空 block；开头/结尾空行忽略；空行按 trim 判断。
- `# ` / `## ` / `### ` 只在空 text-block 行首转换为 text-heading-1/2/3；`#### ` 不转换。
- 新建 image 默认 `display_width=480px`；后续可左右拖拽调整。
- 拖拽 block 显示 before/after 插入线；图片任意位置可作为拖拽源。
- OS 文件拖入页面时只显示 block 插入线，不再显示整页覆盖提示；在 block 上放下不会被 block 拖拽逻辑吞掉。
- 侧边栏：page/database/itemlink 树；只有 page 可展开，database/itemlink 为叶子；节点 hover 提供 `+` 和 page/database 的 `···`。
- 侧边栏菜单：Copy link、Rename、Move to、Remove、Open in new tab、Open in side peek；菜单显示 Last edited / Created Date。
- `+`：page 新建子页面，database 新建条目，itemlink 仅在 target 为 page 时新建子页面。
- Trash 尚未实现，Remove 当前为永久删除；非空容器暂不允许 Remove。详见根目录 [TODOS.md](TODOS.md)。
- 图标：page/database/itemlink 的 emoji 存在 `attributes.icon`，不新增列；缺省回退 📄/🗄️/🔗。
- text-block：纯文本、inline token、Enter 新 block、Backspace 删除空行；无富文本。
- text-heading-1/2/3：与 text-block 共用输入组件；Shift+Enter 块内换行；字号 30/24/20。
- role 数据迁移：旧 `textline` 已迁移为 `text-block`；旧 API role 不再接受。
- image/file：blob/thumb URL；file 下载。
- entity：整行 block；插件 inlineIcon；kind registry；manga reader。
- 漫画：entity kind=manga，image children；RTL/LTR、懒加载、本地进度。
- 设置页：读取/编辑 sys.config。
- 具体见 [docs/item/06-runtime.md](docs/item/06-runtime.md)。

## 10. 工程结构

```text
packages/types   @laibrary/types：类型、zod、action schemas、RPC client、token parser、blob/thumb URL
packages/server  @laibrary/server：Koa RPC、drizzle/PG、blob store、thumbnail service、config service、GC CLI
apps/web         @laibrary/web：React 19 + Vite
docs             规格、愿景、名词表、方法论、重构记录
```

技术栈：Node 24、PostgreSQL 18、drizzle-orm、Koa、zod、sharp、React 19、Vite 8、Vitest。

## 11. 当前状态（v2 POC）

已完成：

- 单表 + role/kind/unity_name + itemlink + database schema（含 unity_name 字段）。
- blobs 内容寻址、file/image Item、上传/读取/去重/GC。
- thumbnails 四档 AVIF 惰性生成、隐藏、级联。
- sys.config database + ConfigStore + 设置页；根 `.env` bootstrap。
- 统一 open resolver；kind registry（manga）。
- 文本 block 编辑器、inline itemlink、块级 itemlink、图片/附件。
- Server 使用闭包工厂（BlobStore/BlobService/ConfigStore/ThumbnailService）与组合根；Web 使用显式 session/tag store/module registry，无 RPC/标签模块单例。
- 漫画阅读器；局域网可运行。
- 测试：server 45、types 20、web 41；lint/typecheck/build 通过。

待做：

- 200 万漫画导入脚本与百万级压测。
- 鉴权/多用户、Cloudflare Access 验证、Electron。
- 文件柜/SMB、富文本、大纲/反链、database 高级视图。
- 派生数据库、Gāng、Public Space。
- 软删除/备份恢复自动化。

## 12. 决策记录

| 决策 | 结论 |
|---|---|
| 一切皆 Item | 单表 + role；用户数据与系统配置都是 Item |
| role 与 kind | role 闭集、服务端理解；kind 开集、仅 entity、客户端理解 |
| 文件 | 文件是 Item；blob 内容寻址，内部表；不再有 FileID/fid_ |
| 缩略图 | 派生表，不是 Item；4 档 AVIF，惰性 |
| unity_name | 全局唯一、不可变；sys. 保留；database 字段类型 |
| 配置 | bootstrap 在 .env；runtime 在 sys.config Item；runtime 无 env 覆盖 |
| 关系 | itemlink target_id + inline token；无 links 表；反链延后 |
| 富文本 | v2 不做；text-block 纯文本 block + token |
| 数据迁移 | 不做；v2 清库重建 |
| 权限 | v2 单用户、无鉴权；LAN 使用 |

## 13. 文档地图

| 文档 | 内容 |
|---|---|
| [AGENTS.md](AGENTS.md) | Agent 工作协议、提示义务、工程/安全规则 |
| [README.md](README.md) | 快速开始、能力与配置入口 |
| [docs/introduction.md](docs/introduction.md) | **完整文档索引**、愿景/原则、阅读路线 |
| [docs/glossary.md](docs/glossary.md) | 名词表 |
| [docs/methods.md](docs/methods.md) | TypeScript 编码硬规则、自查与 Agent 协议 |
| [docs/vision.md](docs/vision.md) | 使用愿景（北极星） |
| [docs/item/01-data-model.md](docs/item/01-data-model.md) | 数据模型 |
| [docs/item/02-file-system.md](docs/item/02-file-system.md) | blobs/缩略图 |
| [docs/item/03-repository.md](docs/item/03-repository.md) | 仓储/校验/分页 |
| [docs/item/04-api.md](docs/item/04-api.md) | API/路由/错误 |
| [docs/item/05-database.md](docs/item/05-database.md) | schema/索引/迁移 |
| [docs/item/06-runtime.md](docs/item/06-runtime.md) | 配置/启动/测试 |
