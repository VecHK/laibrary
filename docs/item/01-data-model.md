# 01 · 数据模型规格

> 术语见 [../glossary.md](../glossary.md)。概览见 [DESIGN.md](../../DESIGN.md)。
> 当前实现是 v2 POC；本文与代码同步。

## 1. items 表

整个基座只有一张 `items` 表。

```sql
CREATE TABLE items (
  id          bigserial PRIMARY KEY,
  role        text NOT NULL DEFAULT 'page',
  kind        text,                        -- 仅 entity 非空
  unity_name  text,                        -- 可选、全局唯一
  title       text NOT NULL DEFAULT '',
  attributes  jsonb NOT NULL DEFAULT '{}',
  tags        bigint[] NOT NULL DEFAULT '{}',
  parent_id   bigint REFERENCES items(id),
  order_index double precision NOT NULL DEFAULT 0,
  blob_id     text REFERENCES blobs(id),
  target_id   bigint,                      -- itemlink 目标；无 FK
  create_date timestamptz NOT NULL DEFAULT now(),
  update_date timestamptz NOT NULL DEFAULT now()
);
```

### 约束

- `role IN ('page','entity','textline','image','file','itemlink','tag','database')`
- `(role='entity') = (kind IS NOT NULL)`
- `(role='itemlink') = (target_id IS NOT NULL)`
- `(role IN ('file','image')) = (blob_id IS NOT NULL)`
- `jsonb_typeof(attributes)='object'`
- `array_position(tags, NULL) IS NULL`
- `abs(order_index) < 'Infinity'::double precision`
- `kind` / `unity_name` 格式（小写 slug；见 §4）

## 2. Role 与 Kind

| role | kind | attributes | 备注 |
|---|---|---|---|
| page | NULL | 自由 record，可含 `icon` | 页面/block 容器 |
| entity | **非空** | 自由 record | 插件/复合内容 |
| textline | NULL | 自由 record（预留） | title 是内容 |
| image | NULL | `{ filename, display_width?, align?, caption? }` | blob 必须是图片；新建默认 display_width=480px，范围 80–1440px |
| file | NULL | `{ filename }` | 任意 blob |
| itemlink | NULL | 自由 record，可含 `icon` | target_id |
| tag | NULL | 自由 record | title 唯一 |
| database | NULL | `{ schema: FieldDef[], icon? }` | 行 = 子项 |

- emoji 展示图标存 `attributes.icon`，不新增 `items.icon` 列；它是 presentation metadata，不索引、不参与搜索。

**kind 只属于 entity。** `page` 永远没有 kind。漫画 = `entity kind=manga` + image children；不是 role。

kind 是开集字符串，服务端只校验格式；客户端 kind registry 决定 inlineIcon/Card/Full/opener。未知 kind 提示“没有合适的打开方式”。

## 3. database

```ts
type FieldDef = { name: string; type: 'string' | 'number' | 'unity_name' }
```

- 行 = 任意 item，其 `parent_id` 指向 database item。
- 写入时按 parent 的 schema 构造 `itemBuildRowValidator`：只校验已声明字段的类型，允许缺字段、允许多余 key。
- 一个 schema 最多一个 `unity_name` 字段；该字段映射 item 的 `unity_name` 列，不进入 attributes；创建行时必须提供，更新不可改。
- 行的标题是 title 列。
- schema 变更只影响新写入，旧行不迁移。

## 4. unity_name

- 可选，全局唯一（`WHERE unity_name IS NOT NULL` 的部分唯一索引）。
- 格式：`^[a-z][a-z0-9._-]*$`，最长 200；`sys.` 前缀保留给系统。
- 设置后**不可变**（update 接口不允许修改）。
- `getItemByUnityName` 查询；公共 listing 默认排除 `sys.%`。
- 不是外键；itemlink 仍用 ItemID。

## 5. 树

- 单父；`parent_id=null` 为根；兄弟按 `order_index` 升序，`id` 决胜。
- 只有 `page`、`entity`、`database` 允许有子项；textline/image/file/itemlink/tag 是叶子。
- 追加：`max(order_index)+1`；插中间由客户端给小数/中点。
- 移动：updateItem 改 parent/order；服务端沿父链检测环（上限 1000）。
- 删除：有子项拒绝；tag 删除时清扫 `tags` 数组；image 删除级联 thumbnails；blob 不立即删。

## 6. tags

- tag 是 role=tag 的 item；title 大小写不敏感唯一。
- item 的 tags 数组存 tag id；无 FK。
- 删除 tag / 删除 tag item 时 `array_remove` 清扫所有引用。
- tag 只做分类；不再有 `sys/type/*` 或 `sys/related/*`。

## 7. 日期

- create_date/update_date 为 timestamptz；对外 ISO 字符串。
- 创建时 now；任何 updateItem/updateTag 都 bump update_date。
- create/parent 变更由服务端处理；客户端不应传 id/日期。

## 8. 索引

见 [05-database.md](05-database.md)。
