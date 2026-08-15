# 05 · 数据库规格

> 原则锚点:P6(高性能)。
> 技术栈:drizzle-orm + drizzle-kit + pg(node-postgres)。PostgreSQL(开发用 docker postgres:latest,见 06)。

## 1. Schema(drizzle)

位置:`packages/server/src/db/schema.ts`;迁移输出 `packages/server/drizzle/`。

当前迁移:

| 迁移 | 内容 |
|---|---|
| 0000_purple_vermin | 建表 + 全部索引 + parent 自引用 FK |
| 0001_rainy_polaris | role 默认值 `'item'` → `'custom'`(item/custom 合并的产物) |

表与索引定义见 [01-data-model.md](01-data-model.md) §1。

## 2. 索引设计说明(P6)

- **tag 唯一性**依赖部分唯一索引 `(lower(title)) WHERE role='tag'`;`newTag` 的 get-or-create 依赖 `ON CONFLICT (lower(title)) WHERE role='tag'`(drizzle 的 onConflictDoUpdate 不接受表达式 target,故用 raw SQL `db.execute`)
- **has_tag 反查**依赖 `tags GIN` 的 `@>` 操作符
- **keyset 分页**依赖排序列 btree + id 决胜;`sort_field` 表达式排序当前无索引(全库规模小;规模化时对常用字段加表达式索引,见 06 路线图)
- `title` 包含搜索为 ILIKE 全扫(v1 规模可接受;规模化加 pg_trgm)

## 3. 连接

- 驱动:node-postgres 连接池(`Pool`,max 10),经 drizzle 封装
- 连接串:`config.database_url`,默认 `postgres://root:root@127.0.0.1:5432/root`;环境变量 `DATABASE_URL` 覆盖
- **自动建库**:`ensureDatabaseExists(database_url, name)` 以 `/postgres` 管理库连接检查 `pg_database`,缺失则 `CREATE DATABASE`(库名白名单 `[a-zA-Z0-9_]+`)
- 启动时执行 `migrate(db, { migrationsFolder })` 应用全部迁移(幂等,由 drizzle 的 journal 保证)

## 4. 类型映射约定

| PG | drizzle 模式 | 对外 JSON |
|---|---|---|
| bigserial / bigint | `{ mode: 'number' }` | number(2^53 边界见 06 路线图) |
| bigint[] | `bigint(...).array()` | number[] |
| jsonb | `.$type<Record<string, unknown>>()` | 对象(attributes 判别联合断言在 wire 层) |
| timestamptz | Date | ISO 字符串 |

## 5. 测试库策略

- 独立库:`laibrary_test`(env `TEST_DATABASE_URL`,默认 `postgres://root:root@127.0.0.1:5432/laibrary_test`)
- helpers(`packages/server/test/helpers.ts`):`prepareTestDb`(自动建库 + migrate)、`truncateItems`(`TRUNCATE items RESTART IDENTITY CASCADE`)、`prepareTestFilePool`(mkdtemp 临时池)
- vitest `fileParallelism: false`(共享单库,串行);beforeEach 清表
- 测试不得依赖 `root` 开发库数据

## 6. 已知边界

- 无显式事务(单条 SQL 为主;deleteTag 两步见 03 文档 §6)
- 无连接池空闲回收调优(v1 默认参数足够)
- jsonb 写入无尺寸校验
