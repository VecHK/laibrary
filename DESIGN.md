# Laibrary 设计文档

Laibrary 是一个"一切皆 Item"的数据基座。所有实体(条目、标签、图片、文件、数据库)都是同一张表里的一行,通过 role 区分身份,通过树与标签表达关系。

## 1. 数据模型

表:`items`(PostgreSQL,经 drizzle 迁移管理)

| 列 | 类型 | 说明 |
|---|---|---|
| id | bigserial PK | 自增;对外以 number 暴露(数据量超 2^53 前无精度问题,届时再改) |
| role | text NOT NULL | `item` / `tag` / `file` / `image` / `database` |
| title | text NOT NULL | 通用显示名;tag 的"名字"就是 title |
| attributes | jsonb NOT NULL | 随 role 变化的内容,见 §2 |
| tags | bigint[] NOT NULL | 指向 role='tag' 的 item id 数组(无 FK,靠服务端清扫) |
| parent_id | bigint NULL FK→items.id | 树:单父 |
| order_index | double precision | 兄弟排序,分数索引 |
| create_date / update_date | timestamptz | 服务端维护 |

索引:

- `(lower(title)) WHERE role='tag'` 部分唯一 —— tag 名唯一(大小写不敏感)
- `(parent_id, order_index)` —— 子项列举
- `tags` GIN —— `@>` 反查携带者
- `role`、`create_date`、`update_date` btree

## 2. role 与 attributes(TS 判别联合)

```ts
type Role = 'item' | 'tag' | 'file' | 'image' | 'database'

interface RoleAttributes {
  item:  Record<string, unknown>
  tag:   Record<string, unknown>
  file:  { src: FileID, filename: string, mime: string, size: number, sha256?: string }
  image: FileAttributes & { image_width: number, image_height: number, cover_src?: FileID }
  database: { schema: FieldDef[] }   // FieldDef = { name, type: 'string' | 'number' }
}
```

- file 是基类,image 继承;将来 audio/video 同样继承 file
- 校验由 `@laibrary/types` 里的 zod 校验器在 API 边界执行,前后端共用
- role 变更时按新 role 重校验 attributes

### database role

- database item 的 attributes.schema 定义字段(仅 string/number)
- **行** = 任意 item,其 `parent_id` 指向 database item
- 行写入/更新时,服务端按 parent 的 schema 动态构造 zod 校验器:只检查已声明字段的类型,**允许缺字段、允许多余 key**
- schema 变更只影响新写入,旧行不做迁移

## 3. 关系机制

### 树(结构)

- 每个 item 最多一个 parent;兄弟按 `order_index` 排序
- 挂父未指定 order_index 时自动 `max+1` 追加;插中间由客户端算**中点**(分数索引);精度耗尽后客户端重新整编
- 移动 = updateItem 改 parent_id/order_index;移动时检测环(不能移到自己的后代之下)
- 删除:有子项拒绝删除(database 删除前必须先删完行,天然安全)

### tag(引用)

- tag 是 role='tag' 的 item,名字即 title,全局唯一(部分唯一索引)
- item 携带 tag = `tags` 数组存 tag item 的 id
- `deleteTag`/`deleteItem`(role='tag')删除时清扫所有 item 的 tags 数组
- 任意 item→item 引用约定:**双方携带同一个 `sys/related/<uuid>/<relate_name>` tag**(如封面、原作等)。这是纯约定,服务端不做结构检查
- v2 候选:若需要引用完整性/级联,加回 links 表

## 4. 文件机制

三层结构,只有第 3 层进数据库:

1. **blob 池(磁盘)**:`filepool_path/2000/123.png`,按 2000 序号分片;`latest.json` 原子记录最新序号
2. **FileID(值类型)**:`"123.png"` = 序号 + 格式,纯字符串逻辑(`@laibrary/types`)
3. **file/image item(数据库)**:attributes 持有 FileID 与元数据

流程:

- **上传**:`POST /file` → 写临时目录 → 取新序号 → rename 到分片路径 → 返回 FileID(此刻数据库还没有任何行)
- **建 item**:客户端 addItem(role='file'/'image'),attributes 带 src 与元数据
- **读取**:先查 item 拿元数据,再 `GET /readfile/:file_id` 取 blob
- **缩略图**:`generateThumb` action(参数是 image item id)→ sharp 生成 avif → 新 FileID 落盘 → 更新 `cover_src`
- **替换**:`POST /file/:file_id` 覆盖 blob,元数据由客户端更新
- **GC**:`clean` 命令。FileID 只出现在文件型 role 的类型化字段里(`FileReferenceKeys` 注册表),收集被引用集合 → 扫磁盘 → 删除**无引用且超过 24h 宽限期**的 blob(宽限期防"刚上传还没建 item"竞态)

## 5. API

- RPC 风格:POST `/action`,`{ action, payload }`;类型全量定义于 `@laibrary/types` 的 `ActionTable`,客户端用 `createRpcClient()` 获得全类型调用
- 校验失败(JSON 请求体)返回 400,业务错误 500,均 `{ message }`
- 文件路由:`POST /file`、`POST /file/:file_id`(替换)、`DELETE /file/:file_id`、`GET /readfile/:file_id`

action 清单:addItem / getItem / getItems / updateItem / deleteItem / listing / newTag / updateTag / deleteTag / searchTag / getTagByTitle / generateThumb

listing 参数:`sort_by(id|create_date|update_date)`、`after_id`(keyset 游标,`(sort_value, id)` 元组比较)、`desc`、`limit`(0=不限)、`filter_rules`/`filter_groups`(and/or/invert,见下)。

过滤规则:`role`(单个或数组)、`title`(ILIKE 包含)、`has_tag`、`empty_tag`、`parent`、`attribute_equal`(jsonb 等值)。

## 6. 工程结构

npm workspaces:

- `packages/types`(`@laibrary/types`):类型、zod 校验器、RPC 客户端、FileID。无 node 依赖,不编译(main 指向 .ts 源码)
- `packages/server`(`@laibrary/server`):drizzle schema/迁移、仓储层、blob 池、API、CLI

docker-compose:postgres(数据挂 `./volumes/postgres_data`)、pgadmin、laibrary(node:24-alpine,挂根目录 + `/app/node_modules` 匿名卷)。开发主模式 = 宿主机跑 app + docker 跑数据库。

## 7. 决策记录

| 决策 | 结论 |
|---|---|
| 一切皆 Item | 单表 + role 判别式;不再有 Tag 池 |
| 引用 | v1 用 sys/related tag 约定,无 links 表(验证期) |
| 内存库 → DB | Drizzle + PostgreSQL,全异步,无内存状态 |
| release_date | 进 attributes(表达式索引按需再加) |
| ID | bigserial,对外 number |
| GC | 手动 clean 命令,24h 宽限期 |
| view / 用户设置 | 不进 v1;以后存成特定 item(role 增量加入) |
| sys/ 前缀检查 | v1 不做 |
| 编辑器 block 类型 | 暂不涉及 |

## 8. 旧数据迁移(待做)

旧 myrepository(v2 JSON 存储:item-pool/tag-pool 分片文件)迁移映射:

- 旧 tag → `role='tag'` item,title = name,attributes 原样
- 旧 item.tags(TagID[])→ 新 tags(映射到新 tag item id)
- 旧 `original: ItemID[]` → 子项的 parent_id = 旧父 item id,order_index = 数组下标+1
- 旧 `original: FileID` / `cover: FileID` → 建 `role='file'`/`image` item(src=FileID),旧 item 与文件 item 各带 `sys/related/<uuid>/<relate_name>` tag 绑定
- 旧 cover_width/cover_height → image item 的 attributes.image_width/image_height
- 旧 release_date → attributes.release_date
- 旧 title/attributes 原样;create_date/update_date 原样
