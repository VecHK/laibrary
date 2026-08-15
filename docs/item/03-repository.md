# 03 · 仓储层规格

> 原则锚点:P1(一切皆 Item)、P5(强校验)、P6(高性能)。
> 位置:`packages/server/src/repo/`(items.ts / tags.ts / wire.ts)。全异步;不持任何内存状态(无池、无 diff)。

## 1. 通用约定

- **wire 映射**(`wire.ts`):`toWireItem(row)` 把 DB 行映射为 API Item——日期转 ISO 字符串,`attributes` 按 role 断言为判别联合形状。`getItemRow` 不存在时抛 `item(id=N) not found`
- **校验顺序是契约**:role zod → parent 存在性 → database 行 schema → 文件引用 → 写入。任一步失败即中止,错误消息见各函数
- createItem/updateItem 需要 `FilePool`(写时校验用);tags 函数不需要

## 2. items 函数

### createItem(db, form, file_pool) → Promise<Item>

| 步 | 校验/行为 | 错误 |
|---|---|---|
| 1 | `checkAttributes(form.role, attributes)`(zod 按 role) | ZodError(400) |
| 2 | parent_id 非 null 时须存在 | `item(id=N) not found` |
| 3 | parent 是 database → `buildRowValidator(parent.schema)` 校验行字段(允许缺字段/多余 key) | ZodError(400) |
| 4 | `checkFileRefsExist` | `attributes.<路径> 引用的文件不存在: <fid>` |
| 5 | order_index:调用方未指定且挂父 → 兄弟 max+1;未指定且根 → 0 | — |
| 6 | tags 去重(`unique`) | — |
| 7 | INSERT RETURNING → wire | — |

### getItem(db, id) / getItems(db, ids)

- getItems 按输入 id 顺序返回;任一不存在抛 `item(id=N) not found`;空数组返回 `[]`

### updateItem(db, id, data, file_pool) → Promise<Item>

| 步 | 行为 | 错误 |
|---|---|---|
| 1 | 取旧行 | `item(id=N) not found` |
| 2 | 新 role = data.role ?? 旧 role;若 data.attributes 提供,按**新 role** 校验 | ZodError |
| 3 | parent 变更:目标须存在;**不得指向自己**;新 parent 不得在自身后代中(沿父链上溯,深度上限 1000) | `parent 不能指向自己` / `不能移动到自己的后代之下` / `父链深度超出限制,数据可能存在环` |
| 4 | 最终 parent 是 database → 行 schema 校验(基于最终 attributes) | ZodError |
| 5 | `checkFileRefsExist`(最终 attributes) | 同 createItem |
| 6 | UPDATE(未提供的字段保持原值;update_date = now()) | — |

注:环检测遍历父链时,若发现数据中已存在环(超出深度上限)同样报错——防御损坏数据。

### deleteItem(db, id) → Promise<void>

| 步 | 行为 | 错误 |
|---|---|---|
| 1 | 取行 | `item(id=N) not found` |
| 2 | 存在子项则拒绝 | `item(id=N) 存在子项,不能删除` |
| 3 | 若 role='tag',清扫:`UPDATE items SET tags = array_remove(tags, N) WHERE N = ANY(tags)` | — |
| 4 | DELETE | — |

### listItems(db, params) → Promise<Item[]>

参数 `ListingParams`:

```
sort_by?:   'id' | 'create_date' | 'update_date' | 'order_index'   (缺省 'id')
sort_field?: { name: string; type: 'string' | 'number' }            (按 attributes 字段排序)
after_id?:  ItemID        (keyset 游标)
desc?:      boolean
limit:      number        (0 = 不限)
filter_rules?: FilterRule[]
filter_groups?: FilterGroup[]
```

**排序表达式**:

| 模式 | 表达式 | 空值 |
|---|---|---|
| sort_by 列 | 直接列 | 列均 NOT NULL |
| sort_field number | `(attributes->>'name')::numeric` | NULLS LAST(升降序一致,空值沉底) |
| sort_field string | `attributes->>'name'` | NULLS LAST |

决胜键恒为 id;ORDER BY `<排序表达式> [ASC\|DESC] NULLS LAST, id`。

**keyset 分页**:游标条件为元组比较 `(<排序表达式>, id) > (<after 行的排序值>, after_id)`(降序 `<`);排序值从 after 行读取。**已知限制**:sort_field 模式下 after 行的该字段为 null/缺失/类型不符时返回 `[]`(分页终止)——v1 约定,DB 视图实际以 limit 0 全量拉取。

## 3. 过滤 DSL

### FilterRule(6 种)

| name | input | SQL 映射 |
|---|---|---|
| role | Role \| Role[] | `=` 或 `IN` |
| title | string | `ilike '%input%'` |
| has_tag | ItemID | `tags @> ARRAY[input]::bigint[]` |
| empty_tag | null | `coalesce(array_length(tags,1),0) = 0` |
| parent | ItemID \| null | `=` 或 `IS NULL` |
| attribute_equal | { name, value(string\|number\|boolean) } | `attributes->name = <jsonb 等值>` |

每条 rule 带 `logic: 'and'|'or'`(组内组合)与可选 `invert`(对单条取反)。

### FilterGroup 语义(与旧实现一致)

- 组内:logic='and' → 全真;'or' → 任一真;rule.invert 先于组逻辑应用
- 组间:group.invert 对组结果取反;所有 'and' 组必须全真;所有 'or' 组取 OR 后并入 AND
- `filter_rules` 等价于一个 `{logic:'and', invert:false}` 的组

## 4. tags 函数

| 函数 | 行为 | 错误 |
|---|---|---|
| newTag(db, title, attributes) | 空名拒绝;`INSERT ... ON CONFLICT (lower(title)) WHERE role='tag' DO UPDATE SET update_date=now()`,再按 title 读回 —— **get-or-create 原子**,重名(不分大小写)返回已有 | `不能设置空 tag 名` |
| updateTag(db, id, {title?, attributes?}) | role 检查;空名拒绝;重名检查(`lower(title)=lower(new) AND id<>self`);UPDATE | `item(id=N) 并不是 tag` / `不能设置空 tag 名` / `重复的 tag 名: X` |
| deleteTag(db, id) | role 检查;有子项拒绝;清扫 tags 数组;DELETE | 同上 + `tag(id=N) 存在子项,不能删除` |
| searchTag(db, name, limit=30) | `role='tag' AND title ilike '%name%' ORDER BY title`,limit 0 = 不限 | — |
| getTagByTitle(db, title) | `role='tag' AND lower(title)=lower(input)` LIMIT 1 → Item \| null | — |

## 5. 辅助函数

| 函数 | 行为 |
|---|---|
| findDatabaseValidator(db, parent_id) | parent 是 database → 解析其 schema 并构造行校验器;否则 null |
| findAncestorIds(db, id, limit=1000) | 沿父链上溯返回祖先 id 列表 |
| buildFilterCondition(rules, groups) | DSL → 单个 SQL 条件(无规则返回 undefined) |

## 6. 事务性现状

- v1 所有仓储操作均为**单条 SQL**(个别为多条独立 SQL,如 deleteTag 的清扫+删除),不使用显式事务
- 已知窗口:deleteTag 两步之间并发写入可能产生短暂不一致——v1 单写者假设下可接受;多用户/协作时需引入事务(见 06 路线图)
