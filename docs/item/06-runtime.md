# 06 · 运行时规格

> 位置:`packages/server/src/config.ts`、`app.ts`、`index.ts`、`cli/`。

## 1. 配置

`config.json`(server 包根目录):

```json
{
  "database_url": "postgres://root:root@127.0.0.1:5432/root",
  "http_api_port": 44998,
  "storage_path": "./storage",
  "filepool_path": "./storage/files"
}
```

| 字段 | 环境变量覆盖 | 说明 |
|---|---|---|
| database_url | `DATABASE_URL` | PG 连接串 |
| http_api_port | `HTTP_API_PORT` | API 端口(默认 44998) |
| storage_path | — | 相对 server 包目录解析;含上传临时目录 `<storage>/uploadtemp` |
| filepool_path | — | blob 池根目录 |

校验:database_url 缺失即启动失败;数字字段非法时回落默认值。

## 2. 启动流程(prepareApp)

```
loadConfig()
  → ensureDatabaseExists()          # 建库(缺失时)
  → createDb() + migrate()          # 应用 drizzle 迁移
  → initFilePool()                  # 初始化 blob 池与 latest.json
  → (API 启动时) 清空 uploadtemp
```

- 入口 `src/index.ts`:`prepareApp()` → `createApi()` → listen(http_api_port)
- 热重载:`tsx watch src/index.ts`(`npm run dev`)

## 3. CLI

### clean(GC)

```
npm run clean        # 即: tsx src/cli/clean.ts
```

执行:prepareApp → `cleanUnreferencedFiles(db, pool)` → 打印 `扫描 N 个 blob,删除 M 个孤儿文件(24h 宽限期)` → 退出。

## 4. 测试

- 框架:vitest(`npm test` 全仓;`npm run test -w @laibrary/server` 单包)
- 测试库:`laibrary_test`(05 文档 §5);文件池用 mkdtemp 临时目录,不碰真实 storage

### 覆盖矩阵(现状)

| 文件 | 覆盖 |
|---|---|
| items.test.ts | 创建/读取、role zod 校验、fid_ 写时校验(含嵌套)、tags 去重、order_index 自动追加与中点、环检测、删除拒绝、database 行校验、schema 重名 |
| tags.test.ts | get-or-create 大小写不敏感、search、重命名与重名/空名拒绝、delete 清扫、deleteItem(tag) 清扫、has_tag |
| listing.test.ts | id 升序/降序、keyset 翻页不重不漏、title/role/attribute_equal/empty_tag、group and/or/invert、sort_field number/string 与空值沉底、sort_field keyset |
| gc.test.ts | scanFileRefs 嵌套发现、custom 深扫防误删、宽限期 |
| file-pool.test.ts | 序号递增、save/load/exists/delete、分片路径、collectBlobFiles |
| api.test.ts | RPC 端到端、get-or-create、未知 action 400、zod 400、坏 FileID 500、缩略图全链、database 校验、字段排序 |

### 已知缺口(v1 接受)

- updateItem 的"部分字段更新"组合矩阵未全覆盖
- 并发/事务窗口未测(单写者假设)
- 网络层未测真实 multipart 边界(仅 supertest attach)

## 5. 路线图(v2 候选,细节)

| 项 | 说明 | 前置 |
|---|---|---|
| links 表 | tag 引用约定升级为结构化边(FK + 级联) | 多用户/协作需求出现 |
| 数据驱动模块注册表 | `sys/type` → 模块映射存进 config item,不写代码加类型 | 前端生态 |
| 鉴权/多用户/协作 | 权限系统;读写接口演进 | 基座稳定 |
| 事务化 | deleteTag 等两步操作进事务 | 同上 |
| 表达式索引 | 常用 attributes 字段(release_date 等)排序/过滤加速 | 数据量 |
| id 精度 | bigserial 超 2^53 时对外改 string | 数据量 |
| Gāng | docs/gang/;Judgement/DSL/Clerk | 基座验证完成 |
| Electron | 桌面壳(纯客户端) | 前端功能完整 |
