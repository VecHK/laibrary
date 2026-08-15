# 04 · API 规格

> 原则锚点:P7(前后端分离、RPC 全类型化)。
> 位置:`packages/server/src/api/`。类型事实源:`@laibrary/types` 的 `ActionTable`(server 实现被其约束,client 用 `createRpcClient` 获得全类型直调)。

## 1. RPC 协议

- 端点:`POST /action`
- 请求体:`{ "action": string, "payload": any }`(JSON)
- 响应:JSON;成功为 action 的返回值的 JSON 序列化
- 错误:一律 `{ "message": string }`

| 状态码 | 情形 |
|---|---|
| 200 | 成功 |
| 400 | 未知 action / 请求体非法 / zod 校验失败 |
| 500 | 业务错误(item 不存在、重复 tag 名、文件引用缺失、删除拒绝等) |

- CORS:`@koa/cors` 默认配置(开放,配合前后端分离与 NAS 场景;鉴权属未来议题)
- 客户端:`createRpcClient(base_url)` 返回每个 action 的直调方法(全类型推导),失败时 throw `Error(message)`

## 2. ActionTable 全量(12 个)

### addItem
```
payload: { role, title?, attributes?, tags?, parent_id?, order_index? }
return:  Item
```
role 必填;校验链见 03 文档 createItem。

### getItem / getItems
```
getItem:  { id: ItemID }          → Item
getItems: ItemID[]                → Item[](按输入顺序)
```

### updateItem
```
{ id: ItemID, data: { role?, title?, attributes?, tags?, parent_id?, order_index? } }
→ { message: 'done' }
```
data 提供哪些字段更新哪些;parent 变更做环检测。

### deleteItem
```
{ id: ItemID } → { message: 'done' }
```
有子项拒绝;role='tag' 时清扫引用。

### listing
```
payload: ListingParams(见 03 文档 §2)
return:  Item[]
```

### newTag
```
{ title: string, attributes?: Record<string, unknown> } → Item
```
get-or-create 原子;空名 500(重复名返回已有)。

### updateTag
```
{ id, data: { title?, attributes? } } → { message: 'done' }
```

### deleteTag
```
{ id } → { message: 'done' }
```

### searchTag
```
{ name: string, limit?: number } → Item[]
```

### getTagByTitle
```
{ title: string } → Item | null
```

### generateThumb
```
{ id: ItemID } → { file_id: FileID }
```
入参为 **image item id**(非 FileID);流程见 02 文档 §6;非 image / 缺 src / src 文件不存在均 500。

## 3. 文件路由

注册于上传路由(koa-body multipart,置于 bodyParser 之前);服务启动时清空上传临时目录 `config.upload_temp_path`。

### POST /file
- multipart,字段名 `file`,单文件(`maxFiles: 1, multiples: false, maxFields: 1`)
- 流程:落临时目录 → `requestFileNumber()` → 按原始文件名扩展名 `constructFileID(num, ext)` → 移到分片路径 → 返回 FileID(JSON 字符串)
- 失败:500 `upload failure: ...`

### POST /file/:file_id
- 替换 blob 内容:file_id 存在则覆盖,不存在 400 `file(id=X) not found`
- **约定**:size/sha256 等元数据由客户端随后更新 item

### DELETE /file/:file_id
- 存在:删除,200 `{message:'done'}`;不存在:404 `file not found(file_id=X)`
- 显式删除后悬空引用由渲染器兜底(02 文档)

### GET /readfile/:file_id
- 流式返回 blob;不存在 404

## 4. 错误消息对照(供客户端显示)

| 情形 | message 形如 |
|---|---|
| 不存在 | `item(id=N) not found` |
| zod 校验 | zod 聚合消息(400) |
| 文件引用缺失 | `attributes.<路径> 引用的文件不存在: fid_N.ext` |
| 环/自指 | `parent 不能指向自己` / `不能移动到自己的后代之下` |
| 删除拒绝 | `item(id=N) 存在子项,不能删除` / `tag(id=N) 存在子项,不能删除` |
| tag 重名 | `重复的 tag 名: X` |
| 空 tag 名 | `不能设置空 tag 名` |
| 缩略图 | `item(id=N) 并不是 image` / `image(id=N) 缺少 src` / `缩略图生成失败,FileID[fid_N.ext]不存在` |
