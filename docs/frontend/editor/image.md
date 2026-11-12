# Image Block

[image.tsx](../../../packages/web/src/modules/image.tsx)、[blob.ts](../../../packages/web/src/lib/blob.ts)

## 数据

- `role='image'`
- `blob_id` 指向图片 blob
- attributes：`filename`、`display_width`（80–1440，默认 480）、`align`、`caption`

## 显示

- 使用 `display_width` 设置容器宽度；
- 图片最大宽度受容器限制；
- 缩略图尺寸 96/384/800/1440；
- 放大时预加载更高档，缩小不请求更小图；
- 保留旧图直到新图加载完成。

## 交互

- 两侧 resize handle 拖动等比调整；
- toolbar：Alignment、Caption、Expand、Download；
- 双击/Expand 打开 lightbox；
- 图片本身是 drag source；
- caption 可点击编辑，borderless。

## 上传

- `createImageItem` 上传 blob，创建 role=image；
- `attributes.filename` + `display_width=480`；
- 失败 toast，不静默。

## 相关

- [Blobs/thumbnails](../mechanisms/blobs-and-thumbnails.md)
- [Paste/drop](paste-and-drop.md)
