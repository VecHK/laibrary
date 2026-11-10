# 03 · 仓储层规格

> 位置：`packages/server/src/repo/`。全异步；写操作由 API action 层包事务。读取/创建/更新/删除在 `items.ts`，listing/filter/keyset 在 `item-listing.ts`；两者都只做仓储，不读环境变量。
> 术语见 [../glossary.md](../glossary.md)。

## 1. 通用约定

- `DbLike = DB | Tx`；repo 函数接受普通连接或事务。
- `toWireItem(row, blob)` 把 DB 行映射为 API Item：日期 ISO，attributes 按 role 断言，blob 转 BlobMeta。
- `getItemRow` 不存在时抛 `item(id=N) not found`（404）。
- `updateItem`/`deleteItem` 使用 `SELECT ... FOR UPDATE`；`updateItem` 只改可写字段。
- 不可变字段：role、kind、unity_name、blob_id。
- AppError code：`VALIDATION/BAD_REQUEST/NOT_FOUND/CONFLICT/PAYLOAD_TOO_LARGE/STORAGE_ERROR/INTERNAL`。

## 2. createItem

校验顺序：

1. role 合法；entity 必须有 kind，其他 role 不允许 kind。
2. unity_name 格式；`sys.` 保留前缀拒绝（除非内部 allow_system）。
3. parent 存在，且 parent role ∈ {page, entity, database}。
4. role attributes zod。
5. 若 parent 是 database：按 schema 校验行；schema 含 unity_name 字段时要求提供；rows 允许缺字段/多余 key。
6. file/image：blob 存在；image 必须是图片且有尺寸；其他 role 不允许 blob_id。
7. itemlink：必须 target_id；target 存在；创建时不可能自指。
8. tags：每个 id 必须是 role=tag；去重。
9. text-block / text-heading-1/2/3：解析 title 中 `[[item:ID]]`，目标必须存在。
10. order_index：未指定则同父 max+1。
11. INSERT；返回 wire（含 blob）。

唯一冲突（unity_name/tag title）→ 409；FK 冲突 → 409。

## 3. updateItem

可写字段：title、attributes、tags、parent_id、order_index、target_id。
不可写：role、kind、unity_name、blob_id（请求 schema 直接拒绝）。

- 先 `FOR UPDATE` 取旧行；系统 unity_name（`sys.`）拒绝修改。
- attributes 提供时按 role 重新校验。
- parent 变更：目标存在；不得指向自己；不得移入自己的后代；目标 role 必须可容纳子项。
- 若最终 parent 是 database：按 schema 校验最终 attributes 和 unity_name 要求。
- itemlink：target_id 可改，必须存在且非自己；其他 role 不允许 target_id。
- tags 提供时校验。
- text-block 与 text-heading-1/2/3：title/attributes 变更时重新校验 inline token（拒绝自指）。`convertTextBlock` 仅允许 text-* role 之间同 ID 转换。
- UPDATE 所有可写字段 + update_date；返回 wire。

## 4. deleteItem

1. `FOR UPDATE` 取行；`sys.` 系统项拒绝。
2. 有子项 → 409。
3. role=tag：清扫所有引用者 tags 数组（同事务）。
4. DELETE；image 的 thumbnails 由 FK 级联；blob 不立即删。
5. 目标被 itemlink 引用时不级联，允许悬空。

## 5. listing

参数见 [04-api.md](04-api.md)。

### 排序

- `sort_by`：id/create_date/update_date/order_index（列均非空）。
- `sort_field`：按 attributes 字段：
  - number：`CASE WHEN jsonb_typeof(attributes -> name)='number' THEN (attributes ->> name)::numeric END`；非数字/缺失 → NULL；`NULLS LAST`。
  - string：`attributes ->> name`；NULLS LAST。
- 决胜键恒为 id；desc 时 id desc。

### keyset

游标值用**同一个 SQL 表达式**从 after 行读取（不是 JS attributes），避免类型/文本化错位。

- after 值为非 NULL：
  - asc：`expr > v OR (expr = v AND id > after) OR expr IS NULL`
  - desc：`expr < v OR (expr = v AND id < after) OR expr IS NULL`
- after 值为 NULL：
  - asc：`expr IS NULL AND id > after`
  - desc：`expr IS NULL AND id < after`

### 过滤

`role`、`kind`、`unity_name`、`title`（ILIKE）、`has_tag`、`empty_tag`、`parent`、`attribute_equal`。
每条 rule 有 logic（and/or）与可选 invert；`filter_groups` 组间 and/or + invert。
公共 listing 默认排除 `unity_name LIKE 'sys.%'`。
`limit=0` 表示不限；服务端上限 10000；根/广场应使用分页。

## 6. tags

- `newTag`：空名拒绝；`INSERT ... ON CONFLICT (lower(title)) WHERE role='tag' DO UPDATE`；get-or-create。
- `updateTag`：必须 role=tag；空名/重名拒绝；FOR UPDATE。
- `deleteTag`：role=tag；有子项拒绝；清扫引用 + 删除（同事务）。
- `searchTag`：ILIKE，limit 0 不限（上限 1000）。
- `getTagByTitle`：大小写不敏感精确查。

## 7. unity_name

- `getItemByUnityName` 返回 Item | null；包括系统项。
- 创建时全局唯一；更新不可改。
- database 的 unity_name 字段由 create/update 的行校验调用方要求；实际值存 item 列。

## 8. 事务与并发

- API action 层对 add/update/delete、tag 写、配置更新包事务。
- item 行锁防同一 item 并发丢失更新；tag 删除与引用赋值同事务。
- v2 POC 单实例、单写者假设；树移动没有全局 advisory lock；多写者/高并发仍需后续硬化（见 DESIGN 待做）。

## 9. 已知边界

- `sort_field` 的键值类型与 SQL 表达式必须一致；number 排序中的字符串按 NULL 处理。
- 并发更新排序字段时分页可能漂移（keyset 固有）。
- `limit=0` 全量仍有上限；超大父节点需分页。
- itemlink 目标删除后允许悬空；渲染器兜底。
- 当前没有 links 表/反链。
