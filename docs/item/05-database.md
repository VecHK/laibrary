# 05 · 数据库规格

> 技术栈：PostgreSQL 18、drizzle-orm、drizzle-kit、node-postgres。
> 当前 v2 是**清库重建**：旧数据无迁移价值，迁移目录已重置为单一基线。

## 1. Schema

### items

```sql
id          bigserial PRIMARY KEY
role        text NOT NULL DEFAULT 'page'
kind        text
unity_name  text
title       text NOT NULL DEFAULT ''
attributes  jsonb NOT NULL DEFAULT '{}'
tags        bigint[] NOT NULL DEFAULT '{}'
parent_id   bigint REFERENCES items(id)
order_index double precision NOT NULL DEFAULT 0
blob_id     text REFERENCES blobs(id)
target_id   bigint
create_date timestamptz NOT NULL DEFAULT now()
update_date timestamptz NOT NULL DEFAULT now()
```

约束见 [01-data-model.md](01-data-model.md) §1。

### blobs

```sql
id          text PRIMARY KEY       -- sha256 hex
size        bigint NOT NULL
mime        text NOT NULL
width       integer
height      integer
create_date timestamptz NOT NULL DEFAULT now()
```

### thumbnails

```sql
image_id    bigint NOT NULL REFERENCES items(id) ON DELETE CASCADE
size        smallint NOT NULL CHECK (size IN (96,384,800,1440))
blob_id     text NOT NULL REFERENCES blobs(id)
width       integer NOT NULL
height      integer NOT NULL
create_date timestamptz NOT NULL DEFAULT now()
PRIMARY KEY (image_id, size)
```

## 2. 索引

| 索引 | 定义 | 用途 |
|---|---|---|
| items_parent_idx | (parent_id, order_index, id) | 子项、树排序、keyset |
| items_role_idx | role | role 过滤 |
| items_kind_idx | kind | kind 过滤 |
| items_tags_gin_idx | tags GIN | has_tag / 反查 |
| items_create_date_idx / update_date_idx | btree | 日期排序/keyset |
| items_blob_id_idx | blob_id | GC/关联 |
| items_target_id_idx | target_id | 反链/查找（未来） |
| items_tag_title_unique_idx | `lower(title) WHERE role='tag'` 唯一 | tag 名 |
| items_unity_name_unique_idx | `unity_name WHERE NOT NULL` 唯一 | unity name |
| blobs_create_date_idx | create_date | GC 候选 |
| thumbnails_blob_id_idx | blob_id | GC 反查 |

3M items / 10M blobs 量级下以上索引足够；不做分表/分区。重点是分页、批量 GC、内容寻址目录扇出。

## 3. 连接与迁移

- 连接串：`DATABASE_URL`（bootstrap）。
- 连接池：node-postgres `Pool`，默认 max 10。
- `dbEnsureExists` 以 `/postgres` 管理库检查并 `CREATE DATABASE`（库名白名单）。
- 启动时 `MIGRATE_ON_START=true` 则执行 drizzle migrate；迁移目录 `packages/server/drizzle/`。
- 新基线：`0000_v2_init.sql`；旧 0000/0001 已移除。
- `drizzle.config.ts` 从 `DATABASE_URL` 读连接串；本地默认 root/root@127.0.0.1/root。

## 4. 重置（dev）

```bash
docker compose exec -T postgres psql -U root -d root \
  -c 'DROP SCHEMA public CASCADE; DROP SCHEMA IF EXISTS drizzle CASCADE; CREATE SCHEMA public;'
rm -rf storage
pnpm db:migrate
```

`drizzle` schema 保存迁移 journal；只 drop public 会导致迁移被跳过。

## 5. 测试库

- 默认 `postgres://root:root@127.0.0.1:5432/laibrary_test`，`TEST_DATABASE_URL` 覆盖。
- `prepareTestDb`：ensure DB → drop public + drizzle → create public → migrate。
- `truncateAll`：`TRUNCATE items, thumbnails, blobs RESTART IDENTITY CASCADE`。
- Vitest `fileParallelism:false`；测试不碰开发库。

## 6. 类型映射

| PG | drizzle | 对外 |
|---|---|---|
| bigserial/bigint | number | number |
| bigint[] | array | number[] |
| jsonb | `$type<Record>` | object |
| timestamptz | Date | ISO string |
| text PK hash | text | string |

## 7. 边界

- 无显式事务包裹跨 action 的流程；单 action 内多语句有事务。
- 无分区/分表；3M 规模靠索引与分页。
- 无软删除/审计表。
- 无表达式索引/pg_trgm（数据量上来再做）。
