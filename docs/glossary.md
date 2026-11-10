# Laibrary 名词表（Glossary）

本文统一 Laibrary 的术语。代码、API、文档、UI 一律使用这里的定义；发现不一致时，以本文和 `DESIGN.md` 的决策记录为准。

| 术语 | 英文 / 代码 | 定义 |
|---|---|---|
| **Item（条目）** | Item | 系统的唯一公共实体。一行 `items` 记录 = id + role + kind + title + attributes + tags + 树位置 + blob/target + 日期。一切用户数据都是 Item。 |
| **Role（角色）** | `role` | Item 的**存储形态**。闭集：`page` / `entity` / `text-block` / `text-heading-1` / `text-heading-2` / `text-heading-3` / `image` / `file` / `itemlink` / `tag` / `database`。服务端理解 role，并用它决定校验、blob、树、tag 等行为。 |
| **Kind（类型）** | `kind` | Item 的**语义类型/打开方式**。开集、只有 `role='entity'` 允许且必须有值，例如 `manga`、`novel`。服务端只存字符串和索引，不理解具体 kind；客户端 kind 模块决定外观和 opener。 |
| **Entity（实体内容）** | `role='entity'` | 带 kind 的复合/插件内容。例子：漫画 = `entity` + `kind=manga` + 若干 `image` 子项。在编辑器中独占一行，可拖拽。 |
| **Page（页面）** | `role='page'` | 普通页面/block 容器。永远没有 kind，永远用页面编辑器打开。 |
| **Text Block（文本块）** | `role='text-block'` | 纯文本 block；内容即 `title`。没有富文本 marks；支持 inline itemlink token。 |
| **Text Heading（文本标题）** | `role='text-heading-1'` 等 | 文本编辑器专用的 heading block；与 text-block 共用输入组件，仅字号与快捷转换不同。 |
| **Image（图片）** | `role='image'` | 指向一个 blob 的图片 Item；MIME/尺寸来自 blob。 |
| **File（附件）** | `role='file'` | 指向一个 blob 的普通附件 Item。文件柜不是这个。 |
| **Itemlink（链接块）** | `role='itemlink'` | 指向另一个 Item 的块级链接；`target_id` 是 ItemID。点击走统一 open resolver。 |
| **Tag（标签）** | `role='tag'` | 用户分类标签；名字即 title，大小写不敏感唯一。tag 不再是“类型分发”。 |
| **Database（数据库）** | `role='database'` | 持有 schema 的 Item；行 = `parent_id` 指向它的 Item。系统配置也用它。 |
| **Unity Name（统一名）** | `items.unity_name` | 可选的、全局唯一的机器可读名字（小写 slug，`sys.` 保留）。设置后不可变。用于系统配置 key、插件根、第三方按名查找。不是外键，itemlink 仍用 ItemID。 |
| **Blob** | `blobs` | 不可变的二进制内容；以 SHA-256 内容哈希为身份，存磁盘，不进 Item 树。 |
| **BlobID** | `BlobID` | blob 的内容哈希（64 位小写 hex）。 |
| **BlobMeta** | `BlobMeta` | `{ id, size, mime, width, height }`；图片有尺寸，其他为 null。 |
| **Thumbnail（缩略图）** | `thumbnails` | image 的派生缓存；4 档 96/384/800/1440 AVIF。不是 Item，隐藏，随 image 级联删除。 |
| **Thumb Size** | `ThumbSize` | `96 \| 384 \| 800 \| 1440`；最大边，保持比例，不放大。 |
| **Kind Module（类型模块）** | kind registry | 客户端注册表：`kind → { inlineIcon, inlineMeta, Card, Full }`。决定 entity 的外观和打开方式。 |
| **Opener（打开器）** | open resolver | 点击 Item 时的统一解析：itemlink 跟随、page 打开页面、entity 按 kind、image/file/database/tag 按 role；找不到提示“没有合适的打开方式”。 |
| **Inline Itemlink（行内链接）** | `[[item:123]]` | text-* block 中的纯文本链接 token；不是富文本。可写 `[[item:123\|标签]]`，`\[[` 转义。 |
| **System Config（系统配置）** | `sys.config` | 一个 `database` Item，`unity_name='sys.config'`；配置行是 `page` Item，`unity_name='sys.config.*'`，attributes 存 value/type。 |
| **Bootstrap Config（启动配置）** | `.env` / env | 连接 DB、端口、存储路径、密钥等**启动前**必须知道的值；只来自环境变量/根 `.env`，不是 Item。 |
| **Runtime Config（运行时配置）** | ConfigStore | 来自 `sys.config` Item 的可编辑设置；热更新，不接受 env 覆盖。 |
| **Block（块）** | block | page/entity 的有序子项。text-block/image/file/itemlink/entity 都可以是 block；支持拖拽排序。 |
| **Open-with（打开方式）** | kind/role opener | 见 Opener。未来 Electron 可接系统 open-with；Web 只做下载/查看。 |
| **Gāng（纲）** | Gang | 未来的信息治序引擎；当前未实现。 |
| **Public Space** | — | 未来的共享空间；当前未实现。 |
| **File Cabinet（文件柜）** | — | 未来的外部目录/SMB 投影；当前未实现。 |

## 术语规则

1. **role 与 kind 不混用**：不要写“role=manga”；正确是 `role='entity', kind='manga'`。
2. **page 不带 kind**：需要 kind 就用 entity。
3. **tag 不是类型**：`sys/type/*` 已废弃；类型用 kind，分类用 tag。
4. **文件不是 FileID**：文件是 file/image Item，字节是 blob；用户数据里不再出现 `fid_`。
5. **缩略图不是 Item**：它是 `thumbnails` 派生缓存。
6. **配置分两层**：bootstrap 在 `.env`，runtime 在 `sys.config` Item。
