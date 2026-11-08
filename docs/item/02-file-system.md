# 02 · 文件与缩略图规格

> 关键决策：文件是 Item；二进制是内容寻址的 blob；缩略图是派生表，不是 Item。
> 不再有 `fid_`、`latest.json`、序号分配器、全表 JSON 深扫。

## 1. 三层结构

```text
file/image Item  ──blob_id──>  blobs(hash, size, mime, width, height)
                                    │
                                    └──> 磁盘 <BLOB_PATH>/ab/cd/<sha256>
thumbnails(image_id, size) ──blob_id──> blobs
```

- **Item**：文件/图片的语义与元数据（filename、树位置、tags）。
- **Blob**：不可变字节；身份 = SHA-256。
- **Thumbnail**：从 image 派生；不进入 Item 树。

## 2. BlobID 与 BlobMeta

- `BlobID`：64 位小写 hex（SHA-256）。
- `BlobMeta = { id, size, mime, width, height }`；图片有 width/height，其他为 null。
- 没有扩展名进入 ID；MIME/文件名是元数据。

## 3. blobs 表

```sql
CREATE TABLE blobs (
  id          text PRIMARY KEY,       -- sha256 hex
  size        bigint NOT NULL,
  mime        text NOT NULL,
  width       integer,
  height      integer,
  create_date timestamptz NOT NULL DEFAULT now()
);
```

索引：`create_date`（供 GC）。

## 4. 磁盘布局

```text
BLOB_PATH/<hash[0:2]>/<hash[2:4]>/<hash>
```

- 两级 hex 扇出 = 65,536 目录；1000 万文件平均约 152 个/目录。
- 无扩展名；MIME 在 DB。
- 原图、附件、缩略图都进同一个池；内容相同即去重。

## 5. 上传

`POST /blob`（multipart 字段 `file`）：

1. 写临时文件（`STORAGE_PATH/uploadtemp`）。
2. 计算 SHA-256；图片用 sharp 读 width/height（EXIF 方向归一）。
3. 若 blobs 已有该 id：删临时文件，返回已有 blob（`reused: true`）。
4. 否则：fsync → rename 到 hash 路径 → `/blob/:id` 可读 → 插 blobs 行。
5. 返回 `{ blob: BlobMeta, reused }`。

失败/崩溃：先文件后行，可能留下孤儿文件；GC/审计处理。临时目录在 API 启动时清理。

## 6. 创建 file/image Item

- `addItem` 必须带 `blob_id`（file/image）；服务端校验 blobs 存在。
- image 还要求 blob 的 MIME 以 `image/` 开头且 width/height 非空。
- attributes 只存 `filename`；尺寸/MIME/size 从 blob 得到。
- `blob_id` **创建后不可变**；替换内容 = 新 blob + 新 Item。
- 自定义内容需要多个文件 → 子 file/image Item；不允许把 blob 字符串塞进 attributes。

## 7. 读取

`GET/HEAD /blob/:id`：

- MIME/size 来自 blobs；`Content-Length`、`ETag: "<hash>"`。
- `Cache-Control: public, max-age=31536000, immutable`。
- 支持单区间 `Range`；`Accept-Ranges: bytes`。
- 404 当 blob 行/文件不存在。
- 无公共 DELETE/替换路由；删除交给 GC。

## 8. GC

`npm run clean`：

1. 从 `items.blob_id` + `thumbnails.blob_id` 收集引用。
2. 找 `create_date < now - grace` 且无引用的 blobs。
3. 分批（默认 1000）删行 + 删文件。
4. 宽限期默认 24h（`sys.config.gc_grace_hours`）。

不做全表 JSON 扫描。孤儿文件（无行）不会被自动发现；后续审计脚本处理。删除 image 级联 thumbnails；blob 在无引用后由 GC 回收。

## 9. 缩略图

### 9.1 表

```sql
CREATE TABLE thumbnails (
  image_id    bigint NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  size        smallint NOT NULL CHECK (size IN (96,384,800,1440)),
  blob_id     text NOT NULL REFERENCES blobs(id),
  width       integer NOT NULL,
  height      integer NOT NULL,
  create_date timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (image_id, size)
);
```

- 不是 Item；没有 listing/search/树入口，隐藏是结构性的。
- image 删除级联；thumb blob 由 GC 回收。
- 行只在生成成功后写入；不存在 pending 状态。

### 9.2 访问

```text
GET /thumb/:image_id?size=96|384|800|1440
```

1. 校验 image role/尺寸。
2. 行存在 → 直接返回 blob。
3. 不存在 → 读 image.blob → sharp `rotate → flatten(白底) → resize(size,size,{fit:'inside',withoutEnlargement:true}) → avif(quality 40, effort 4)` → 新 blob → 插入行 → 返回。
4. 单实例用进程内 per-key promise 去重；多实例允许重复生成（hash 去重）。
5. 响应：`image/avif`、ETag=thumb hash、immutable cache。

尺寸是最大边；不放大；漫画阅读器用原图，不用 1440 当阅读源。

### 9.3 封面

- Item 不再有 cover 字段。
- 漫画封面由第一张 image 的 384 thumb 提供；列表/entity inlineIcon 自行取第一张。
- 如未来需要显式封面，使用 `cover_image_id`（ItemRef）而不是 blob cover。

## 10. 未来：文件柜

文件柜是**外部目录/SMB 投影**，不复制成 blob；需要独立连接器/外部引用。不要复用 blobs 或 `blob_id`。
