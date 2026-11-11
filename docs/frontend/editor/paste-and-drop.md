# 粘贴与拖入

## 外部纯文本

`splitTextBlocks`：

- 每非空行一个 block；
- 1 个空行忽略；
- >=2 个空行生成一个空 block；
- 开头/结尾空行忽略；
- 空行按 `trim()`；
- 支持 CRLF/CR。

### 粘贴

- 无换行：浏览器原生；
- 有换行：第一块替换当前 selection 留在当前 block；后续块在当前后创建 text-block；焦点最后一项。
- 当前 heading 第一块保留 heading；list/todo 第一块保留当前 role。

### 外部拖入

- PageFull 接受 `text/plain`；
- 按目标 block before/after 插入；
- 空白区域 append；
- 全部创建 text-block，不合并目标内容。

## 文件

- `Files` 由 PageFull 处理；
- `image/*` → image；
- 其他 → file；
- 多文件保持顺序；
- 每个文件上传 blob 后创建 Item；
- 插入后补一条空 text-block；
- PageBlock 只显示插入线，外部 drop 不拦截。

## 内部 block 拖拽

- `text/laibrary-block` 由 PageBlock 处理；
- 使用 order_index 插入 before/after；
- 不混淆外部文本。

## 相关

- [Drag/reorder](drag-reorder.md)
- [File](file.md)
- [Image](image.md)
- [PageFull](page-full.md)
