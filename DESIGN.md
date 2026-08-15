# Laibrary 设计文档

Laibrary 是一个"一切皆 Item"的数据基座,终极目标是替代文件系统:不再编辑二进制,而是编辑结构化数据,并根据结构化数据呈现不同的东西。

> **文档指引**:本文档是**概览与决策记录**(为什么这么做 + 项目现状)。实现级规格见 `docs/`:愿景见 `docs/introduction.md`,Item 系统规格见 `docs/item/01~06`。文档与实现同步更新,以文档为准。

## 1. 数据模型

表:`items`(PostgreSQL,经 drizzle 迁移管理)

| 列 | 类型 | 说明 |
|---|---|---|
| id | bigserial PK | 自增;对外以 number 暴露(数据量超 2^53 前无精度问题) |
| role | text NOT NULL | `custom` / `tag` / `textline` / `file` / `image` / `database`,默认 custom |
| title | text NOT NULL | 通用显示名;tag 的"名字"就是 title;textline 的"内容"就是 title |
| attributes | jsonb NOT NULL | 随 role 变化的结构化数据,见 §2 |
| tags | bigint[] NOT NULL | 指向 role='tag' 的 item id 数组(无 FK,靠服务端清扫) |
| parent_id | bigint NULL FK→items.id | 树:单父 |
| order_index | double precision | 兄弟排序,分数索引 |
| create_date / update_date | timestamptz | 服务端维护 |

索引:`(lower(title)) WHERE role='tag'` 部分唯一(tag 名大小写不敏感唯一)、`(parent_id, order_index)`、`tags` GIN、`role`、`create_date`、`update_date` btree。

## 2. role 与 attributes(TS 判别联合)

```ts
type Role = 'custom' | 'tag' | 'textline' | 'file' | 'image' | 'database'

interface RoleAttributes {
  custom:  Record<string, unknown>   // 一切自定义内容(页面、漫画……)
  tag:     Record<string, unknown>
  textline: Record<string, unknown>  // 一行纯文本,内容即 title
  file:  { src: FileID, filename: string, mime: string, size: number, sha256?: string }
  image: FileAttributes & { image_width: number, image_height: number, cover_src?: FileID }
  database: { schema: FieldDef[] }   // FieldDef = { name, type: 'string' | 'number' }
}
```

**role 的定位**:role 只给"基座需要直接处理的种类"——基座要处理 file/image 的 blob(GC/缩略图/尺寸),要处理 database 的 schema 校验,要处理 tag 的唯一名,要处理 textline 的行内编辑。**其余一切内容类型都是 custom + tag**(见 §4),基座不认识它们。

- 校验由 `@laibrary/types` 的 zod 校验器在 API 边界执行,前后端共用;custom/tag/textline 为宽松 record
- role 变更时按新 role 重校验 attributes

### database role

- database item 的 attributes.schema 定义字段(仅 string/number)
- **行** = 任意 item,其 `parent_id` 指向 database item
- 行写入/更新时,服务端按 parent 的 schema 动态构造 zod 校验器:只检查已声明字段的类型,**允许缺字段、允许多余 key**
- schema 变更只影响新写入,旧行不做迁移
- 行的"标题"字段 = title 列(Notion 同构)

## 3. FileID 与文件机制

### FileID = 自描述类型值

```
FileID = "fid_123.png"    // fid_ 前缀 + 序号 + 格式
```

`fid_` 前缀是系统认领的命名空间——"类型进运行时":TS 里的 branded type 在 jsonb 里有了自己的语法。

### 引用发现与 GC

- **引用发现**:任何 item、任何 role、任何嵌套深度的 attributes 里出现的 `fid_` 字符串都是文件引用(`scanFileRefs` 递归扫描)
- **写时校验**:addItem/updateItem 时递归扫 attributes,凡 `fid_` 指向不存在的 blob 一律拒绝写入,报错带字段路径——拼错 FileID 根本进不了库
- **GC**(`clean` 命令):全表深扫收集被引用 FileID → 与磁盘 blob 交集 → 删除**无引用且超过 24h 宽限期**的 blob(宽限期防"刚上传还没建 item"竞态)
- 无引用注册表、无 ownership 表——一条统一规则,与 role 完全解耦

### blob 池(磁盘)

- `filepool_path/2000/fid_2001.png`,按 2000 序号分片;`latest.json` 原子记录最新序号
- 上传 `POST /file` → 落盘 → 返回 FileID;读取 `GET /readfile/:file_id`;替换 `POST /file/:file_id`;删除 `DELETE /file/:file_id`(显式删除后悬空引用由渲染器兜底)
- 缩略图:`generateThumb` action(参数为 image item id)→ sharp 生成 `fid_NN.avif` → 更新 `cover_src`

## 4. 类型系统:role=custom + tag + 模块注册表

**基座不知道 manga 是什么**——content 类型是"应用",不是"内核"。

- custom item 通过携带类型 tag 声明身份:`sys/type/<名>`(如 `sys/type/manga`);`sys/` 为系统类型命名空间
- **客户端模块注册表**:`tag 名 → { Presenter, Editor, zod? }`;解析规则:固定 role 模块(textline/file/image/database/tag)直接命中;custom 按 tags 匹配注册表;未命中走**缺省模块(页面)**
- 模块接口:`Presenter { card(嵌入), full(打开) }` + `Editor { inline(就地), detail(面板) }`;listing 布局(table/gallery/strip)是第三维,与模块正交
- 新类型 = 打 tag + 注册表加一行,零服务端改动;演进路径:注册表数据驱动化(存进 DB 的 config item,不写代码加类型)
- custom 的 attributes 形状约束下沉到模块层(客户端 zod 表单,校验失败就地报错;缺字段给默认值)

## 5. API

- RPC 风格:POST `/action`,`{ action, payload }`;类型全量定义于 `@laibrary/types` 的 `ActionTable`,客户端用 `createRpcClient(baseurl)` 获得全类型调用
- 校验失败(JSON 请求体)返回 400,业务错误 500,均 `{ message }`
- 文件路由:`POST /file`、`POST /file/:file_id`(替换)、`DELETE /file/:file_id`、`GET /readfile/:file_id`

action 清单:addItem / getItem / getItems / updateItem / deleteItem / listing / newTag / updateTag / deleteTag / searchTag / getTagByTitle / generateThumb

listing 参数:`sort_by(id|create_date|update_date)`、**`sort_field({name, type:'string'|'number'})`**(按 attributes 字段排序,类型由客户端提供,空值 NULLS LAST 沉底)、`after_id`(keyset 游标,`(sort值, id)` 元组比较)、`desc`、`limit`(0=不限)、`filter_rules`/`filter_groups`(and/or/invert)。

过滤规则:`role`(单个或数组)、`title`(ILIKE 包含)、`has_tag`、`empty_tag`、`parent`、`attribute_equal`(jsonb 等值)。

## 6. 关系机制

### 树(结构)

- 每个 item 最多一个 parent;兄弟按 `order_index` 排序
- 挂父未指定 order_index 自动 `max+1` 追加;插中间由客户端算中点(分数索引);精度耗尽后重新整编
- 移动 = updateItem 改 parent_id/order_index;移动时检测环
- 删除:有子项拒绝删除(database 删除前必须先删完行)
- 页面内容 = 子项;漫画页 = 子 image items;媒体引用通过子 file/image items 或 attributes 里的 FileID 表达

### tag(引用与分类)

- tag 是 role='tag' 的 item,名字即 title,全局唯一(部分唯一索引),大小写不敏感
- item 携带 tag = `tags` 数组存 tag item id;deleteTag/deleteItem(tag)删除时清扫所有引用
- tag 是唯一横跨所有 role 的编辑能力(分类正交于类型)——这正是 tag 必须全局的原因
- 任意 item→item 引用约定:双方携带同一个 `sys/related/<uuid>/<relate_name>` tag(纯约定,服务端不做结构检查)

## 7. 前端(apps/web)

- Vite + React 19,前后端分离:baseurl 连接页(测试连接后存 localStorage),适配 NAS 场景与未来 Electron
- hash 路由(`#/plaza`、`#/item/:id`);`@laibrary/types` 提供 `createRpcClient`/`createFileUrl`/`uploadFile`
- 三个视图:**全局广场**(listing + role 过滤)、**页面视图**(子项 + textline 行内编辑 + 图片上传)、**database 视图**(表格 + cell 编辑 + schema 管理 + 字段排序)
- 模块注册表驱动渲染与编辑(见 §4);v1 模块:page(缺省)/textline/image/database/tag/file/manga(`sys/type/manga`,懒加载横向阅读器,reading_direction 从 attributes 读,缺省 rtl)

## 8. 工程结构

npm workspaces:

- `packages/types`(`@laibrary/types`):类型、zod 校验器、RPC 客户端、FileID、HTTP 帮助函数。无 node 依赖,不编译(main 指向 .ts 源码)
- `packages/server`(`@laibrary/server`):drizzle schema/迁移、仓储层、blob 池、GC、API、CLI
- `apps/web`(`@laibrary/web`):前端

docker-compose:postgres(数据挂 `./volumes/postgres_data`)、pgadmin、laibrary(node:24-alpine)。开发主模式 = 宿主机跑 app + docker 跑数据库。

## 9. 决策记录

| 决策 | 结论 |
|---|---|
| 一切皆 Item | 单表 + role 判别式;item 与 custom 合并,默认 custom |
| 内容类型 | custom + `sys/type/<名>` tag + 客户端模块注册表;不新增 role |
| 引用完整性 | tag 约定(`sys/related/...`),无 links 表(验证期) |
| FileID | `fid_` 前缀自描述值;写时校验;GC 全表深扫 |
| 内存库 → DB | Drizzle + PostgreSQL,全异步 |
| ID | bigserial,对外 number |
| GC | 手动 clean 命令,24h 宽限期 |
| view / 用户设置 | 以后存成特定 config item(数据驱动注册表的演进路径) |
| 编辑器富文本 | v1 纯文本 textline;以后格式化内容序列化进 textline attributes |

## 10. 项目现状(Todo)

**已完成(v1)**:

- [x] monorepo(packages/types、packages/server、apps/web)
- [x] 数据基座:items 单表 + role 判别联合 + 树 + tags;Drizzle + PostgreSQL
- [x] FileID `fid_` 自描述值;写时校验;GC 深扫 + 24h 宽限期
- [x] database role(schema 校验、行编辑、字段排序)
- [x] RPC 全类型化(`ActionTable` + `createRpcClient`);文件上传/替换/删除/读取;缩略图
- [x] 前端最小客户端:连接页、广场、页面视图(textline 行内编辑 + 图片上传)、database 视图、模块注册表(custom+tag 分发)、漫画阅读器(懒加载 + 页管理)
- [x] 测试 65 项全绿;lint/typecheck 干净;docs/ 规格文档

**待做(Todo)**:

- [ ] 高并发/事务验证(deleteTag 两步原子化)
- [ ] 鉴权与多用户/协作(权限系统)
- [ ] 数据驱动模块注册表(类型映射存 config item)
- [ ] links 表(若 tag 引用约定验证失败)
- [ ] 表达式索引与 pg_trgm(数据量上来后)
- [ ] Gāng(见 docs/introduction.md,Todo 标记;规格预留 docs/gang/)
- [ ] Electron 桌面壳
