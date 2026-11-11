# Laibrary

Laibrary 是一个“一切皆 Item”的个人数据基座：结构化数据、文件、页面、漫画、数据库、系统配置都统一为 Item；文件字节以内容寻址的 blob 存储；展示与打开方式由 role + kind 决定。

当前是 **v2 POC**：面向单机/局域网、单用户，先完成“文本编辑 + 漫画阅读”的垂直切片，并为百万级 Item 留好索引与存储结构。

- Agent 工作协议：[AGENTS.md](AGENTS.md)
- 完整文档索引与阅读顺序：[docs/introduction.md](docs/introduction.md)
- 设计概览与决策：[DESIGN.md](DESIGN.md)
- 编程方法论（TypeScript 硬规则）：[docs/methods.md](docs/methods.md)
- 愿景：[docs/vision.md](docs/vision.md)
- 术语表：[docs/glossary.md](docs/glossary.md)
- 前端文档入口：[docs/frontend/introduction.md](docs/frontend/introduction.md)
- 前端 UI/UX 原则：[docs/frontend/designs.md](docs/frontend/designs.md)
- 编辑器术语表：[docs/frontend/glossary.md](docs/frontend/glossary.md)
- 数据模型：[docs/item/01-data-model.md](docs/item/01-data-model.md)
- 文件与缩略图：[docs/item/02-file-system.md](docs/item/02-file-system.md)
- API：[docs/item/04-api.md](docs/item/04-api.md)
- 运行时/配置：[docs/item/06-runtime.md](docs/item/06-runtime.md)

## 快速开始

要求：Node 24、Docker（PostgreSQL 18）。

```bash
cp .env.example .env
docker compose up -d postgres
npm install

# API（默认 http://127.0.0.1:44998）
npm run dev

# 另开终端：Web（http://127.0.0.1:5173）
npm run web
```

Web 首次打开会要求填写 API 地址（默认 `http://127.0.0.1:44998`），地址存在 localStorage。

### 检查

```bash
npm run lint
npm run typecheck
npm test
npm run build -w @laibrary/web
```

测试需要 PostgreSQL。测试库默认 `postgres://root:root@127.0.0.1:5432/laibrary_test`，可用 `TEST_DATABASE_URL` 覆盖；测试会重建 schema。

### 清空/重置数据

旧数据没有迁移价值，v2 直接重建：

```bash
# 停止 API 后
docker compose exec -T postgres psql -U root -d root \
  -c 'DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;'
rm -rf storage
npm run db:migrate
npm run dev
```

## 配置

### Bootstrap（`.env` / 环境变量）

启动前必须知道的值，不是 Item：

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 连接串（必填） |
| `HTTP_API_PORT` | API 端口，默认 44998 |
| `HOST` | 监听地址，默认 0.0.0.0 |
| `STORAGE_PATH` | 临时上传目录的根，默认 `./storage` |
| `BLOB_PATH` | 内容寻址 blob 根，默认 `./storage/blobs` |
| `LOG_LEVEL` | debug/info/warn/error |
| `MIGRATE_ON_START` | 启动时自动迁移，默认 true |

OS 环境变量优先于根 `.env`；`.env` 不提交，只提交 [`.env.example`](.env.example)。生产应使用真实环境变量/secret manager；密钥不要放进 Item。

### Runtime（`sys.config` Item）

可编辑的系统设置存在 `sys.config` database 的 Item 中，从设置页修改，立即生效；**不接受 env 覆盖**。

当前默认项：

- `sys.config.gc_grace_hours`
- `sys.config.upload_max_bytes`
- `sys.config.manga_default_direction`
- `sys.config.ui_page_size`
- `sys.config.config_version`

## 当前能力

- role：`page / entity / text-block / text-heading-1 / text-heading-2 / text-heading-3 / text-list / text-todo / image / file / itemlink / tag / database`
- kind：仅 entity，例如 `manga`
- 文本：页面 block、text-block、text-heading-1/2/3、text-list、text-todo、`/` 插入菜单（含新页面）、`# ` 快捷标题、Enter 拆行、Shift+Enter 软换行、inline `[[item:123]]`、块级 itemlink、图片/附件；多行粘贴/拖入按空行规则拆块
- 漫画：`entity + kind=manga` + image children，阅读器（RTL/LTR、懒加载、本地进度）
- 文件：内容寻址 blob、去重、Range 读取、GC
- 缩略图：96/384/800/1440 AVIF，惰性生成
- 系统配置：`sys.config` database + 设置页
- 打开方式：统一 open resolver；未知 kind 提示“没有合适的打开方式”

## 暂未实现

富文本/marks、大纲缩进、反向链接、文件柜/SMB、database 高级视图、派生数据库、Gāng、Public Space、鉴权/多用户、Cloudflare Access 代码、Electron、200 万数据导入。

## 目录

```text
packages/types   @laibrary/types：类型、zod、RPC 客户端、token parser、blob/thumb URL
packages/server  @laibrary/server：Koa RPC、drizzle/PG、blob、缩略图、配置服务
apps/web         @laibrary/web：React 19 + Vite 客户端
docs             设计、规格、愿景、术语表、方法论
```
