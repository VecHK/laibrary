# 06 · 运行时规格

> 位置：`packages/server/src/config/`、`app.ts`、`index.ts`、`cli/`。
> 配置分两层：bootstrap 在 `.env`，runtime 在 `sys.config` Item。

## 1. Bootstrap 配置

根目录 `.env`（不提交；`.env.example` 提交），OS env 优先于 `.env`；server 用 `process.loadEnvFile` 读取，不覆盖已有 env。

| 变量 | 默认 | 说明 |
|---|---|---|
| `DATABASE_URL` | 必填 | PostgreSQL |
| `HTTP_API_PORT` | 44998 | API 端口 |
| `HOST` | 0.0.0.0 | 监听地址 |
| `STORAGE_PATH` | ./storage | 上传临时目录根 |
| `BLOB_PATH` | ./storage/blobs | blob 根 |
| `LOG_LEVEL` | info | 日志级别（启动期） |
| `MIGRATE_ON_START` | true | 启动自动迁移 |

`config.json` 已删除。路径相对仓库根解析（`REPO_ROOT` 由 `packages/server/src/config/bootstrap.ts` 计算）。密钥只放 env/secret，不进 Item。

## 2. Runtime 配置

`sys.config` database（unity_name=`sys.config`）：

```text
sys.config (database)
  └─ sys.config.gc_grace_hours        page  title/value/type
  └─ sys.config.upload_max_bytes      page
  └─ sys.config.manga_default_direction
  └─ sys.config.ui_page_size
  └─ sys.config.config_version
```

- ConfigStore `ensure()`：查找/创建 system DB、seed 缺失默认行、修复 schema。
- `load()`：读取子项、合并默认值、缓存。
- `update()`：校验 key 前缀/类型；更新行；失效缓存。
- `getConfig` / `updateConfig` action；设置页编辑。
- 通用 item 写接口拒绝 `sys.` unity_name；公共 listing 排除 `sys.%`。
- runtime **不接受 env 覆盖**；bootstrap 不进入 Item。

## 3. 启动流程

```text
bootstrapLoadEnv() + bootstrapLoadConfig()
→ dbEnsureExists
→ CreateDb({ database_url })
→ migrate（MIGRATE_ON_START）
→ CreateBlobStore({ root, on_error }) + init()
→ CreateBlobService({ db, store })
→ CreateConfigStore({ db, on_error }) + ensure() + reload()
→ CreateThumbnailService({ db, blobs })
→ CreateApi({ config, db, blobs, config_store, thumbnails })
→ listen(HOST, HTTP_API_PORT)
```

`CreateApi` 构造 `/blob` multipart 中间件与 `/action` 路由；每次 upload 读取 runtime `upload_max_bytes`（硬上限 1GiB）。

## 4. API 进程

- Koa 3 + CORS + koa-body(multipart) + @koa/bodyparser(JSON 4mb)。
- `/action` 统一 zod payload；AppError/ZodError 映射状态码；未知 action 400。
- 无鉴权；仅可信局域网。
- 单实例假设：缩略图生成用进程内 per-key promise；配置缓存单实例。

## 5. CLI

### clean（GC）

```bash
npm run clean
```

`appPrepare` → 读 `gc_grace_hours` → `cleanUnreferencedBlobs` → 批量删无引用 blob → 退出。

### DB

```bash
npm run db:generate   # drizzle 生成迁移
npm run db:migrate    # 应用迁移
```

## 6. 测试

```bash
npm test
npm run test -w @laibrary/server
npm run test -w @laibrary/types
npm run test -w @laibrary/web
```

- server 测试需要 PostgreSQL；`TEST_DATABASE_URL` 默认 laibrary_test。
- 测试 helper 重置 public + drizzle schema，再迁移。
- 测试串行（共享测试库）。
- web 测试为 pure functions/registry；无浏览器渲染测试。
- 当前：server 46、types 22、web 47。

## 7. Web

```bash
npm run web   # Vite 5173
```

- 连接页保存 API baseurl 到 localStorage。
- hash 路由：`#/plaza`、`#/item/:id`、`#/settings`。
- page block 编辑器：无固定工具栏，`/` 分组插入菜单、Enter 拆行、Shift+Enter 软换行、inline itemlink；hover gutter + block 菜单；文本编辑本地更新，不整页刷新；entity/manga、设置页。
- Block 焦点：首/末视觉行上下键跨 block；Esc/handle 进入选中模式；只有 `.page-full` 外可 marquee 框选，内容区内是普通文本选择；Shift+Arrow 扩展；Del/Backspace 批量删除；undo/redo 通过 `deleteItems`/`restoreItems` 保持原 ID，历史仅当前页面内存。Shift+Click/Cmd+Click 不选 block。
- 图片 block：左右拖拽等比缩放（80–1440px）、Alignment/Caption/Expand/Download 浮层、双击/Expand 打开 lightbox、放大预加载高一级缩略图；拖动有 before/after 插入线。
- 页面接受 OS 文件拖入：`image/*` → image，其他 → file；多文件按目标 block 的 before/after 插入，空白处追加到末尾，并补空 text-block；拖拽时只显示插入线，不显示整页覆盖提示。
- `- ` / `1. ` / `a. ` / `[] ` / `【】 ` 只在空 text-block 行首转换为列表/勾选项；列表 marker 自动计算。列表/勾选项 Enter 在光标处拆分，右侧进入同类型新项，caret 在新项开头。
- 外部纯文本拖入/粘贴按空行规则拆块；`# ` / `## ` / `### ` 只在空 text-block 行首转换为 text-heading-1/2/3；Shift+Enter 对所有 text-* 只做块内换行。
- 新建 image 默认显示宽度 480px（后续可用两侧 bar 调整，硬上限 1440px）。
- 侧边栏：page/database/itemlink 树；page 才可展开，database/itemlink 不展开。节点 hover 显示 `+`（page/database，以及 target=page 的 itemlink）和 page/database 的 `···` 菜单。
- 侧边栏菜单：Copy link、Rename、Move to、Remove、Open in new tab、Open in side peek；显示 Last edited / Created Date。Trash 未实现，非空容器暂不允许 Remove。
- 页面/数据库/ Itemlink 的 emoji 图标存 `attributes.icon`；缺省回退 📄/🗄️/🔗。
- 构建：`npm run build -w @laibrary/web`。

## 8. 部署（当前）

- `docker compose up -d postgres`（postgres:18，数据在 `./volumes/postgres_data`）。
- API 在宿主机 `npm run dev`；Web 在宿主机 `npm run web`；或由反代托管 dist。
- 局域网直接访问；公网需要额外反代 + Cloudflare Access/token（未实现）。
- 单用户、单实例；不要直接暴露 44998 到公网。

## 9. 路线图（v2 之后）

- 200 万漫画导入脚本、百万级压测、分页 UI。
- 鉴权/token、多用户、Cloudflare Access 验证。
- 文件柜/SMB、富文本、大纲/反链、database 高级视图。
- 派生数据库、Gāng、Public Space、Electron。
- 备份/恢复自动化、软删除。
