# 前端测试与验证

## 单元

`packages/web/test/`：

- 纯函数：order、text-block-editor、text-list、marquee、image-thumb、hash-router、date-format；
- 稳定 registry/sidebar tree；
- 行为逻辑优先抽纯函数再测。

## 浏览器验证

行为 UI 必须用真实浏览器/headless Chrome 验证：

1. 启动 dev web/server；
2. 打开固定页面；
3. 执行键盘/鼠标/拖拽；
4. 检查 DOM、API、焦点、selection、toast；
5. 清理临时数据。

不能只靠 typecheck/build 声称交互完成。

## 必测矩阵

- 编辑/选中/文本选择三模式；
- Enter/Shift+Enter/Backspace/Esc/Delete/undo；
- Slash 默认项/上下/Enter；
- paste/drop 文件与文本；
- image resize/lightbox；
- Breadcrumbs 导航/浏览器后退；
- mobile/narrow 宽度。

## 命令

```bash
npm run lint
npm run typecheck
npm test
npm run build -w @laibrary/web
```

## 相关

- [Keyboard map](../reference/keyboard-map.md)
- [Designs](../designs.md)
