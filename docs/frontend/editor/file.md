# File Block

[file.tsx](../../../apps/web/src/modules/file.tsx)、[blob.ts](../../../apps/web/src/lib/blob.ts)

## 数据

- `role='file'`
- `blob_id`
- attributes 仅 `{ filename }`（strict）
- title 为文件名

## 显示

- Block：📎 + filename + MIME
- Full：文件名、MIME、大小、下载按钮
- 文件名从 `zFileAttributes` 解析，失败回退 title

## 上传

`createFileItem` 必须只传 `{ filename }`。`display_width` 是 image 专属，传入会被 `zFileAttributes.strict()` 拒绝。

## 下载

通过 blob URL 的 `<a download>`；不提供公共 blob 删除/替换 API。

## 相关

- [Blobs/thumbnails](../mechanisms/blobs-and-thumbnails.md)
- [Paste/drop](paste-and-drop.md)
