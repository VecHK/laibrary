# Blob 与缩略图

## Blob

- 内容寻址 SHA-256；
- `POST /blob` 上传，读/下载走 blob URL；
- 文件/图片 Item 持有 blob_id；
- 不用 attributes 存文件字节。

## Image 上传

`createImageItem`：

1. upload blob；
2. addItem role=image；
3. attributes `{ filename, display_width: 480 }`。

`createFileItem` 只传 `{ filename }`；display_width 属于 image。

## Thumbnail

- 隐藏表 `thumbnails`；
- 尺寸 96/384/800/1440；
- lazy 生成/缓存；
- image 删除级联；thumb blob 由 GC 回收；
- `pickThumbSize` 根据 display_width/DPR 选择。

## UI

- Image 先显示缩略图，再按需加载原图/更高档；
- lightbox 使用原图；
- download 使用 blob URL。

## 相关

- [Image](../editor/image.md)
- [File](../editor/file.md)
- [Server file spec](../../item/02-file-system.md)
