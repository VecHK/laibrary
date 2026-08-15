# 01 · 数据模型规格

> 原则锚点:P0(第一性原理)、P1(一切皆 Item)、P3(类型进运行时)、P4(约定优于机制)。
> 概览见 `DESIGN.md`,愿景见 `../introduction.md`。

## 1. items 表

整个数据基座只有**一张表**。所有实体(页面、标签、文本行、文件、图片、数据库)都是这同一张表里的行,由 `role` 区分身份。

```sql
CREATE TABLE "items" (
  "id"          bigserial PRIMARY KEY NOT NULL,           -- 自增;对外暴露为 number
  "role"        text NOT NULL DEFAULT 'custom',           -- 见 §2
  "title"       text NOT NULL DEFAULT '',                 -- 通用显示名
  "attributes"  jsonb NOT NULL DEFAULT '{}'::jsonb,       -- 结构化负载,见 §3
  "tags"        bigint[] NOT NULL DEFAULT '{}',           -- 指向 role='tag' 的 item id 数组
  "parent_id"   bigint REFERENCES items(id),              -- 树:单父(自引用 FK,无级联)
  "order_index" double precision NOT NULL DEFAULT 0,      -- 兄弟排序,分数索引
  "create_date" timestamp with time zone NOT NULL DEFAULT now(),
  "update_date" timestamp with time zone NOT NULL DEFAULT now()
);
```

### 列语义

| 列 | 语义 | 维护者 |
|---|---|---|
| id | 全局唯一序号(bigserial)。对外 JSON 中为 number;超过 2^53 前无精度问题(当前边界,见 06 路线图) | 数据库 |
| role | 身份判别式,决定 attributes 的形状与校验(§2) | 写入时由调用方提供 |
| title | 通用显示名:tag 的名字、textline 的文本内容、其余实体的标题 | 调用方 |
| attributes | 结构化负载(JSONB),形状随 role 变化(§3) | 调用方,服务端按 role 校验 |
| tags | 本 item 携带的 tag id 数组。**无外键**,靠清扫式维护(§5) | 调用方 + 清扫 |
| parent_id | 树父节点;null = 根 | 调用方(updateItem 移动) |
| order_index | 同父兄弟间的排序值(分数索引,§4) | 服务端(自动追加)或调用方(指定) |
| create_date / update_date | 创建/最后更新时间。create 一次性;update 每次写入 bump | 服务端 |

### 索引

| 索引 | 定义 | 用途 |
|---|---|---|
| items_pkey | id btree | 主键、keyset 决胜 |
| items_parent_idx | (parent_id, order_index) btree | 子项列举、树排序 |
| items_role_idx | role btree | role 过滤 |
| items_tags_gin_idx | tags GIN | `@>` 反查携带者、has_tag 过滤 |
| items_create_date_idx / items_update_date_idx | btree | 日期排序与 keyset |
| items_tag_title_unique_idx | **部分唯一** `(lower(title)) WHERE role='tag'` | tag 名大小写不敏感全局唯一 |

## 2. Role 体系

```
Role = 'custom' | 'tag' | 'textline' | 'file' | 'image' | 'database'
```

**role 的定位(P1/P2)**:role 只给"基座必须直接处理的种类"——file/image(基座管理其 blob:缩略图、尺寸、GC)、database(基座校验 schema)、tag(基座保证唯一名)、textline(行内编辑基建)、custom(其余一切)。**基座不认识 manga/novel 等内容类型**,它们一律是 `custom` + `sys/type/<名>` tag(见 §5 与 03 文档)。

| Role | 语义 | attributes 形状 |
|---|---|---|
| custom | 一切自定义内容:页面、漫画、配置……(缺省 role) | 自由记录 |
| tag | 全局标签;名字即 title,大小写不敏感唯一 | 自由记录 |
| textline | 一行纯文本;内容即 title | 自由记录 |
| file | 普通文件:元数据 + blob 引用 | 见 §3 |
| image | 图片:继承 file + 尺寸 + 缩略图 | 见 §3 |
| database | 数据库:持有字段 schema;行 = parent 指向它的任意 item | 见 §3 |

## 3. attributes 判别联合(TS 与 zod)

TS 侧(`@laibrary/types`)用判别联合保证编译期类型;zod 校验器在 API 边界做运行期校验(P3)。两者必须同步更新。

```ts
type Role = 'custom' | 'tag' | 'textline' | 'file' | 'image' | 'database'

interface RoleAttributes {
  custom:   Record<string, unknown>
  tag:      Record<string, unknown>
  textline: Record<string, unknown>
  file: {
    src: FileID          // blob 引用,fid_ 语法(02 文档)
    filename: string     // 原始文件名,非空
    mime: string         // MIME,非空(描述性字段,不参与类型分发)
    size: number         // 字节数,非负整数
    sha256?: string      // 可选
  }
  image: FileAttributes & {
    image_width: number   // 必填正整数
    image_height: number  // 必填正整数
    cover_src?: FileID    // 缩略图 blob,懒生成,可选
  }
  database: {
    schema: Array<{ name: string; type: 'string' | 'number' }>
  }
}
type Item<R extends Role = Role> = ItemBase & { role: R; attributes: RoleAttributes[R] }
```

### 校验规则(zod,逐字段)

| Role | 规则 | 校验器 |
|---|---|---|
| custom / tag / textline | 任意 record | `z.record(z.string(), z.unknown())` |
| file | src 必须匹配 FileID 正则;filename/mime 非空;size ≥ 0 整数;sha256 可选 | `zFileAttributes` |
| image | file 全部规则 + image_width/height 正整数 + cover_src 可选 FileID | `zImageAttributes` |
| database | schema 数组;name 非空;type ∈ {string, number};**name 不得重复** | `zDatabaseAttributes` |

### database role 的语义

- database item 的 `attributes.schema` 定义字段(仅 string/number)
- **行** = 任意 item,其 `parent_id` 指向 database item(树包含)
- 行写入时,服务端按 parent 的 schema 动态构造 zod 校验器(`buildRowValidator`):只检查已声明字段的类型,**允许缺字段、允许多余 key**(passthrough)
- schema 变更只影响新写入,旧行不迁移
- 行的"标题"字段 = title 列(与 Notion 的 title property 同构)
- 行可以有自己的子项、tags,与任何 item 无差别

## 4. 树

- 单父:每个 item 最多一个 parent;parent_id = null 为根
- 有序:`order_index` 决定兄弟顺序,升序排列
- **分数索引**:追加到末尾 = 当前 max + 1(服务端自动);插到两兄弟之间 = 两值中点(客户端计算,如 1 与 2 之间取 1.5)。插中间不改写任何已有行
- 移动 = updateItem 改 parent_id/order_index;服务端做**环检测**(新 parent 不得是自身或自身后代,沿父链上溯,深度上限 1000)
- 删除:**有子项拒绝删除**(含 database:先删完行)
- 页面内容 = 子项;database 行 = 子项;漫画页 = 子 image 项

## 5. tags 语义

- tag 是 `role='tag'` 的 item;名字即 title;`(lower(title)) WHERE role='tag'` 部分唯一索引保证**大小写不敏感全局唯一**
- item 携带 tag = `tags` 数组存 tag id(**无 FK**)
- **清扫式维护**:deleteTag 与 deleteItem(role='tag')时,服务端执行 `array_remove` 更新所有引用者的 tags 数组;不存在级联
- 三个用途合一:
  1. **分类**:业务标签,自由打
  2. **类型分发**:`sys/type/<名>`(如 `sys/type/manga`),客户端模块注册表据此解析(客户端行为,服务端零感知)
  3. **引用绑定**:`sys/related/<uuid>/<relate_name>`,双方携带同一 tag 即绑定(纯约定,服务端不做结构检查)

## 6. 日期维护

- create_date/update_date 为 timestamptz;对外 JSON 为 ISO 字符串
- 创建:两者 = now()
- 更新:update_date = now()(任何 updateItem/updateTag 都 bump;客户端高频编辑应做防抖)
- 排序/分页可用 create_date、update_date(03 文档);release_date 等业务日期放 attributes,需要时加表达式索引(见 06 路线图)
