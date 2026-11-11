# 04 · API 规格

> 类型事实源：`@laibrary/types` 的 `ActionTable`。客户端 `CreateRpcClient({ base_url })` 获得全类型调用，并对响应做 zod 校验。

## 1. RPC

- 端点：`POST /action`
- 请求：`{ "action": string, "payload": any }`
- 成功：JSON 语义的 action 返回值
- 错误：`{ message, code, issues? }`
- 状态：
  - 200 成功
  - 400 未知 action / payload zod / 业务校验（VALIDATION/BAD_REQUEST）
  - 404 不存在（NOT_FOUND）
  - 409 冲突（CONFLICT）
  - 413 上传过大（PAYLOAD_TOO_LARGE）
  - 500 内部/存储（INTERNAL/STORAGE_ERROR）

未知 action 用 `Object.hasOwn` 白名单，不会命中对象原型。

## 2. Item

```ts
{
  id, role, kind, unity_name, title, attributes, tags,
  parent_id, order_index,
  blob: { id, size, mime, width, height } | null,
  target_id,
  create_date, update_date
}
```

- `file/image`：`blob` 必填；attributes 只有 `{ filename }`。
- `entity`：kind 非空；page：kind null。
- 无 `src`/`cover_src`/`image_width`/`image_height`。

## 3. Actions（17）

### addItem
```text
{ role, kind?, unity_name?, title?, attributes?, tags?, parent_id?, order_index?, blob_id?, target_id? }
→ Item
```
约束见 [03-repository.md](03-repository.md)。role 创建后不可变；唯一例外是 text-* role 之间通过 `convertTextBlock` 转换。

### getItem / getItems
```text
getItem: { id } → Item
getItems: ItemID[] → Item[]（保持输入顺序）
```

### updateItem
```text
{ id, data: { title?, attributes?, tags?, parent_id?, order_index?, target_id? } }
→ { message: 'done' }
```
不可修改 role/kind/unity_name/blob_id。itemlink 可改 target_id。

### deleteItem
```text
{ id } → { message: 'done' }
```
有子项 409；tag 清扫；image 级联 thumbnails；blob 留给 GC。

### deleteItems
```text
ItemID[] → Item[]
```
一次物理删除每个目标及其整棵子树，返回完整 Item 快照；tag/system 整批拒绝。blob 保留给 GC。

### restoreItems
```text
Item[] → Item[]
```
按 parent 从浅到深插回，显式使用快照中的原 Item ID/create_date/update_date/所有字段；ID 冲突、parent/blob 不存在、唯一键冲突会报错。不恢复 thumbnails，图片缩略图懒生成。

### convertTextBlock
```text
{ id, role: 'text-block' | 'text-heading-1' | 'text-heading-2' | 'text-heading-3' | 'text-list' | 'text-todo', title?, attributes? } → Item
```
仅允许 text-* role 之间转换；同 ID；title/attributes 可选并与 role 原子更新；非文本 role 400。

### listing
```text
{
  sort_by?: 'id'|'create_date'|'update_date'|'order_index',
  sort_field?: { name, type: 'string'|'number' },
  after_id?, desc?, limit,
  filter_rules?, filter_groups?
} → Item[]
```
`limit` 0–10000；0 表示不限（仍受服务端上限）。公共 listing 排除 `sys.%`。详见 03 文档。

### getItemByUnityName
```text
{ unity_name } → Item | null
```

### newTag
```text
{ title, attributes? } → Item
```
get-or-create，大小写不敏感；空名 400。

### updateTag
```text
{ id, data: { title?, attributes? } } → { message: 'done' }
```
重名 409；空名 400。

### deleteTag
```text
{ id } → { message: 'done' }
```
有子项 409；清扫引用。批量删除不接受 tag。

### searchTag
```text
{ name, limit? } → Item[]
```
limit 0 = 不限（上限 1000）。

### getTagByTitle
```text
{ title } → Item | null
```

### getConfig
```text
{} / undefined → { version, entries: [{ key, title, type, value }] }
```
来自 `sys.config` database；包含默认值。

### updateConfig
```text
{ key, value } → { message: 'done' }
```
key 必须 `sys.config.*`；类型由配置项类型校验；未知 key 404。

## 4. 文件路由

### POST /blob
multipart，字段 `file`；大小上限来自 runtime `sys.config.upload_max_bytes`。
返回 `{ blob: BlobMeta, reused: boolean }`。

### GET / HEAD /blob/:blob_id
- `blob_id` 64 位 hex。
- 200 流；`Content-Type`、`Content-Length`、`ETag`、`Cache-Control: immutable`、`Accept-Ranges`。
- `Range` 单区间 → 206；非法范围当前回退 200。
- 404 不存在。

### GET /thumb/:image_id?size=96|384|800|1440
- image role 校验；size 必须四档之一。
- 惰性生成 AVIF；返回 `image/avif`、ETag、immutable cache。
- image 非 image / 不存在：400/404。

### 无
`POST /file`、`POST /file/:id`、`DELETE /file/:id`、`GET /readfile/:id` 已移除。

## 5. CORS / 鉴权

- `@koa/cors` 默认开放，适配前后端分离与 NAS。
- 当前无鉴权；只应在可信局域网使用。公网需交付层 Access/反代，未来再做 token。

## 6. 错误消息示例

| 情形 | message / code |
|---|---|
| item 不存在 | `item(id=N) not found` / NOT_FOUND |
| unity 重复 | `unity_name 或 tag 名重复` / CONFLICT |
| tag 重复 | `重复的 tag 名: X` / CONFLICT |
| 有子项 | `item(id=N) 存在子项，不能删除` / CONFLICT |
| 系统项 | `系统 item 不能通过通用接口修改` / BAD_REQUEST |
| 没有 opener | 客户端提示 `没有合适的打开方式` |
| blob 缺失 | `blob(<id>) not found` / NOT_FOUND |
