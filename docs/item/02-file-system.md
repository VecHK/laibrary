# 02 · FileID 与文件机制规格

> 原则锚点:P3(类型进运行时)、P5(结构化数据 + 强校验)、P6(高性能)。
> 关键决策:二进制 blob **长期存放磁盘,不进 PostgreSQL**;数据库只存结构化元数据与引用。

## 1. 三层结构

```
┌ 第1层 blob 池(磁盘,哑存储)───────────────────────────────┐
│  filepool_path/<分片>/fid_<序号>.<ext>                    │
│  latest.json(序号计数器,原子写)                           │
└───────────────────────────────────────────────────────────┘
┌ 第2层 FileID(值类型,存在于 attributes 内)────────────────┐
│  "fid_123.png" = 前缀 + 序号 + 格式                       │
└───────────────────────────────────────────────────────────┘
┌ 第3层 file/image item(数据库行)──────────────────────────┐
│  { role:'file', attributes:{ src:'fid_123.png', ... } }  │
└───────────────────────────────────────────────────────────┘
```

## 2. FileID 语法

```
FileID  := "fid_" <number> ["." <format>]
number  := \d+            (非负安全整数)
format  := [a-zA-Z0-9]+   (可空;空 = 无扩展名)
```

- 正则(`@laibrary/types` 中的 `isFileIDShape` 与 `zFileID` 共用):`^fid_\d+(\.[a-zA-Z0-9]+)?$`
- `fid_` 前缀是系统认领的命名空间:**类型进运行时**——TS 的 branded type `FileID` 在 JSONB 里拥有自己的语法,任何嵌套深度都能被可靠识别
- 曾用 `fid:`(冒号),因 Windows 文件名不允许冒号改为下划线

### 函数(`@laibrary/types/src/FileID.ts`)

| 函数 | 签名 | 行为 |
|---|---|---|
| constructFileID | `(num: number, format?: string) => FileID` | 校验序号(非负安全整数)与格式(字母数字)后拼装,非法抛错 |
| parseFileID | `(fid: FileID) => [number, string \| null]` | 剥前缀解析序号与格式,非法抛错 |
| name2number | `(name: string) => number` | 解析纯数字序号 |
| isFileIDShape | `(value: unknown) => value is FileID` | 形状判定(GC/写时校验依赖) |

## 3. blob 池

- 位置:`config.filepool_path`(默认 `<server>/storage/files`)
- 分片:序号按 `__FILE_POOL_SPLIT_INTERVAL__ = 2000` 分片,`splitPoint(interval, n) = floor(n / interval) * interval`;路径 = `<filepool>/<splitPoint>/fid_<n>.<ext>`
- 序号:`latest.json` 记录最新已分配序号;`requestFileNumber()` 自增并以 vait Sequence **串行化写入保证原子性**

### FilePool 接口(`src/blob/file-pool.ts`)

| 方法 | 行为 |
|---|---|
| requestFileNumber(): Promise<number> | 分配新序号,原子落盘 latest.json |
| getFilePath(fid) / fileBasePath(fid) | 路径计算 |
| saveFile(fid, buf) | 建目录后写入 |
| loadFile(fid) | 读取 Buffer |
| deleteFile(fid) | 存在则删除 |
| fileExists(fid) | 存在性检查 |
| collectBlobFiles() | 递归扫全部 blob,返回 `[{ file_id, path, mtime_ms }]`(跳过 latest.json) |

## 4. 写时校验(P5)

**任何 role、任何嵌套深度的 attributes 里出现的 `fid_` 字符串都是文件引用**;写入时若引用不存在则拒绝。这使 custom 可以自由持有 FileID(如 3D 漫画贴图),而坏引用根本进不了库。

### 函数(`src/blob/gc.ts`)

| 函数 | 行为 |
|---|---|
| scanFileRefs(value): FileID[] | 递归遍历 JSONB 收集全部 `fid_` 字符串 |
| scanFileRefEntries(value, path): [{path, fid}] | 同上,带字段路径(用于错误消息) |
| checkFileRefsExist(file_pool, attributes): Promise<void> | 逐个 `fileExists`;失败抛错,消息形如 `attributes.textures.front 引用的文件不存在: fid_999.png` |

### 适用入口

| 入口 | 校验时机 |
|---|---|
| createItem | role zod 校验 → database 行校验 → **文件引用校验** → INSERT |
| updateItem | 同上(按最终 attributes 校验) |
| newTag / updateTag | 不校验(v1 约定:tag attributes 不放 FileID) |

### 设计要点

- 上传先落盘、后建 item,故"引用已存在的 blob"在正常流程下必成立
- 校验 = 每次写入对每个 fid 做一次 stat,开销可忽略

## 5. GC(clean 命令)

**引用发现**:全表深扫——`SELECT attributes FROM items` 全部行,递归收集 `fid_` 字符串,得引用集合。无引用注册表、无 ownership 表,一条统一规则,与 role 完全解耦。

**清理算法**(`cleanUnreferencedFiles(db, pool, grace_ms = 24h, now)`):

1. `refs = collectReferencedFileIds(db)`(全表深扫)
2. `blobs = pool.collectBlobFiles()`(磁盘扫描)
3. 对每个 blob:若 `file_id ∉ refs` 且 `now - mtime_ms > grace_ms`,删除
4. 返回 `{ scanned, deleted }`

**宽限期 24h**:保护"刚上传完 blob、客户端还没来得及建 item"的竞态。手动命令触发(非守护进程)。

**语义**:保守方向——误判只会多留一个孤儿,绝不误删被引用的文件;引用与磁盘存在性交集后,业务字符串(如恰好长得像 FileID)不会造成数据损失。

## 6. 缩略图(generateThumb)

- 入参:image item 的 id(而非裸 FileID)
- 流程:校验 role='image' → 读 `src` → sharp(`rotate → flatten → resize(300, null, withoutEnlargement) → avif(quality 40, effort 8)`,cache 关闭)→ 申请新 FileID(`fid_<n>.avif`)→ 落盘 → 更新该 item 的 `cover_src` → 返回 `{ file_id }`
- 失败语义:非 image role / 缺 src / src 文件不存在均抛错
- 展示约定:封面优先 `cover_src`,缺失则 `src`

## 7. 文件路由(见 04 文档细节)

| 路由 | 行为 |
|---|---|
| POST /file | multipart 上传(字段名 file)→ 临时目录 → 新 FileID → 落盘 → 返回 FileID |
| POST /file/:file_id | 替换 blob 内容(元数据由客户端更新约定) |
| DELETE /file/:file_id | 删除 blob(显式删除;残留悬空引用由渲染器兜底) |
| GET /readfile/:file_id | 流式读取 blob |
